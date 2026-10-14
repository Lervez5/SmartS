/**
 * SMS gateway client.
 *
 * One client, selected from `SMS_PROVIDER`, so the send path has a single place
 * to hand a message to and the rest of the system never learns which gateway is
 * configured. Each adapter speaks the provider's own HTTP API with the
 * credentials from the environment.
 *
 * The client is deliberately the only thing that knows a provider exists. Two
 * rules hold across every method:
 *
 *   1. "Accepted" is not "delivered". `send` returns what the provider said
 *      about the request, which is a receipt for the message, not proof it
 *      reached a handset. Only a delivery callback sets that.
 *
 *   2. Nothing is fabricated. With no provider configured, every method fails
 *      with a reason rather than returning a plausible-looking success, so the
 *      workspace can report the truth instead of a green tick.
 */

/** Which gateways this client can actually speak. */
export type SmsProviderName = 'africastalking' | 'termii';

/** What a provider said about a request. */
export interface SmsSendResult {
  /**
   * Whether the provider accepted the request. NOT delivery - see the module
   * comment.
   */
  accepted: boolean;
  /** The provider's own identifier for the message, when it returns one. */
  providerMessageId: string | null;
  /** Human-readable failure, or the provider's own error text. */
  error: string | null;
  /** How the provider charged or costed the request, when it reports it. */
  cost: string | null;
  /** Raw provider response, kept for auditing a discrepancy. */
  raw?: unknown;
}

export interface SmsCreditBalance {
  /** Whether a balance was actually reported. */
  available: boolean;
  balance: string | null;
  currency: string | null;
  reason: string | null;
}

/** A delivery report from a provider callback. */
export interface SmsDeliveryReport {
  /** Provider message id the report refers to. */
  providerMessageId: string;
  /** Normalised outcome. */
  status: 'delivered' | 'failed' | 'unknown';
  /** Failure reason from the provider, when it gives one. */
  failureReason: string | null;
}

export interface SmsGatewayClient {
  readonly provider: SmsProviderName;
  readonly configured: boolean;
  /** Why it is unusable, in the operator's terms. Null when ready. */
  readonly blocker: string | null;
  /**
   * The sender id this gateway would send as, from the environment.
   *
   * Exposed so the capability check can name the sender that would actually be
   * used rather than reporting whatever an administrator typed in settings.
   */
  readonly senderId: string | null;
  send(params: {
    to: string[];
    body: string;
    senderId?: string | null;
    /** URL the provider should call with delivery reports. */
    callbackUrl?: string;
  }): Promise<SmsSendResult>;
  getCreditBalance(): Promise<SmsCreditBalance>;
}

/* ------------------------------------------------------------------ *
 * Configuration
 * ------------------------------------------------------------------ */
/**
 * The SMS configuration as it stands right now.
 *
 * Read from the environment on each call rather than from the frozen `config`
 * object, which is parsed once at import. That mattered twice over: it made the
 * client untestable, because a test that set the variables after the module was
 * loaded was talking to a config that had already been built; and it meant a
 * deployment that edited its environment and reloaded kept using the old
 * credentials with nothing to indicate it.
 */
function smsConfig() {
  const env = process.env;
  return {
    provider: env.SMS_PROVIDER,
    apiKey: env.SMS_API_KEY,
    username: env.SMS_USERNAME,
    senderId: env.SMS_SENDER_ID,
    baseUrl: env.SMS_BASE_URL,
    webhookSecret: env.SMS_WEBHOOK_SECRET,
  };
}

/**
 * Resolves which gateway, if any, this deployment has.
 *
 * A provider is only usable with both a key and the credential the provider calls
 * a username - Africa's Talking rejects a send without one, and the failure would
 * surface per message rather than at startup.
 */
function resolveProvider(): { provider: SmsProviderName; blocker: string | null } {
  const configured = smsConfig();

  // An unknown value cannot select a client that exists, so it falls back to the
  // default adapter and says so - rather than silently sending through the wrong
  // gateway or failing at runtime on the first message.
  const provider: SmsProviderName =
    configured.provider === 'termii' || configured.provider === 'africastalking'
      ? configured.provider
      : 'africastalking';

  if (!configured.provider) {
    return {
      provider,
      blocker:
        'No SMS provider is configured. Set SMS_PROVIDER along with SMS_API_KEY, ' +
        'SMS_USERNAME and SMS_SENDER_ID.',
    };
  }

  if (configured.provider !== 'termii' && configured.provider !== 'africastalking') {
    return {
      provider,
      blocker:
        `SMS_PROVIDER "${configured.provider}" is not a gateway this build supports; ` +
        'expected africastalking or termii.',
    };
  }

  if (!configured.apiKey) {
    return {
      provider,
      blocker: `SMS_API_KEY is not set for ${provider}.`,
    };
  }

  if (provider === 'africastalking' && !configured.username) {
    return {
      provider,
      blocker: "Africa's Talking requires SMS_USERNAME in addition to SMS_API_KEY.",
    };
  }

  return { provider, blocker: null };
}

/* ------------------------------------------------------------------ *
 * Africa's Talking
 * ------------------------------------------------------------------ */

const AT_DEFAULT_BASE_URL = 'https://api.africastalking.com';

/**
 * Africa's Talking adapter.
 *
 * Chosen as the default because the platform's currency is KES and the school's
 * locale is Kenya, which is where this gateway operates. The API is JSON over
 * HTTPS with an API-key header; sandbox and production differ only by base URL
 * and by whether the username is `sandbox`.
 */
class AfricasTalkingClient implements SmsGatewayClient {
  readonly provider = 'africastalking' as const;

  private readonly apiKey: string | undefined;
  private readonly username: string | undefined;
  private readonly baseUrl: string;
  readonly blocker: string | null;

  constructor(blocker: string | null) {
    this.apiKey = smsConfig().apiKey;
    this.username = smsConfig().username;
    this.baseUrl = (smsConfig().baseUrl?.trim() || AT_DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.blocker = blocker;
  }

  get configured(): boolean {
    return this.blocker === null;
  }

  get senderId(): string | null {
    // An empty env var is how the shipped .env holds the slot open, and it means
    // "not configured" just as an absent one does.
    return smsConfig().senderId?.trim() || null;
  }

  private headers(): Record<string, string> {
    return {
      // The key is sent as a header, not in the body, so it is not at risk of
      // ending up in a URL or an access log.
      apiKey: this.apiKey ?? '',
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
  }

  async send(params: {
    to: string[];
    body: string;
    senderId?: string | null;
    callbackUrl?: string;
  }): Promise<SmsSendResult> {
    if (!this.configured) {
      return { accepted: false, providerMessageId: null, error: this.blocker, cost: null };
    }

    const senderId = params.senderId ?? this.senderId;
    if (!senderId) {
      return {
        accepted: false,
        providerMessageId: null,
        error:
          'No sender ID is configured. Set SMS_SENDER_ID in the environment, or a sender ID on ' +
          "the school's notification settings.",
        cost: null,
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/version1/messaging`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          username: this.username,
          to: params.to.join(','),
          message: params.body,
          from: senderId,
          ...(params.callbackUrl ? { bulkSMSMode: true, enqueue: 1 } : {}),
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        SMSMessageData?: {
          Message?: string;
          Recipients?: Array<{
            messageId?: string;
            status?: string;
            cost?: string;
            statusCode?: number;
          }>;
        };
      } | null;

      if (!response.ok) {
        return {
          accepted: false,
          providerMessageId: null,
          error: `Africa's Talking rejected the request (HTTP ${response.status}).`,
          cost: null,
          raw: payload,
        };
      }

      const recipients = payload?.SMSMessageData?.Recipients ?? [];
      // A per-recipient status other than 100/101 means that number was not
      // accepted even though the request as a whole was.
      const rejected = recipients.find(
        (recipient) => recipient.statusCode && recipient.statusCode >= 200
      );

      if (recipients.length === 0 || rejected) {
        return {
          accepted: false,
          providerMessageId: null,
          error:
            rejected?.status ??
            payload?.SMSMessageData?.Message ??
            "Africa's Talking accepted the request but returned no recipients.",
          cost: null,
          raw: payload,
        };
      }

      return {
        accepted: true,
        providerMessageId: recipients[0]?.messageId ?? null,
        error: null,
        cost: recipients[0]?.cost ?? null,
        raw: payload,
      };
    } catch (err) {
      // A timeout or a network failure is an uncertain outcome, not a refusal.
      // The message may have been accepted, so the caller must not assume it
      // was not - which is why this is surfaced as an error rather than a
      // "not sent" verdict.
      const message = err instanceof Error ? err.message : 'unknown error';
      return {
        accepted: false,
        providerMessageId: null,
        error:
          `Could not reach Africa's Talking: ${message}. The outcome is uncertain - ` +
          'reconcile before resending.',
        cost: null,
      };
    }
  }

  async getCreditBalance(): Promise<SmsCreditBalance> {
    if (!this.configured) {
      return { available: false, balance: null, currency: null, reason: this.blocker };
    }

    try {
      const response = await fetch(`${this.baseUrl}/version1/user`, {
        method: 'GET',
        headers: this.headers(),
      });
      const payload = (await response.json().catch(() => null)) as {
        UserData?: { balance?: string };
      } | null;

      const balance = payload?.UserData?.balance;
      if (!balance) {
        return {
          available: false,
          balance: null,
          currency: null,
          reason: "Africa's Talking did not report a balance.",
        };
      }

      return { available: true, balance, currency: null, reason: null };
    } catch (err) {
      return {
        available: false,
        balance: null,
        currency: null,
        reason: `Could not reach Africa's Talking: ${
          err instanceof Error ? err.message : 'unknown error'
        }.`,
      };
    }
  }
}

/* ------------------------------------------------------------------ *
 * Termii
 * ------------------------------------------------------------------ */

const TERMII_DEFAULT_BASE_URL = 'https://api.ng.termii.com';

/**
 * Termii adapter.
 *
 * Offered alongside Africa's Talking because a deployment in Nigeria or Ghana
 * will not have an Africa's Talking account. The same rules apply: accepted is
 * not delivered, and nothing is fabricated.
 */
class TermiiClient implements SmsGatewayClient {
  readonly provider = 'termii' as const;
  readonly blocker: string | null;

  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;

  constructor(blocker: string | null) {
    this.apiKey = smsConfig().apiKey;
    this.baseUrl = (smsConfig().baseUrl?.trim() || TERMII_DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.blocker = blocker;
  }

  get configured(): boolean {
    return this.blocker === null;
  }

  get senderId(): string | null {
    // An empty env var is how the shipped .env holds the slot open, and it means
    // "not configured" just as an absent one does.
    return smsConfig().senderId?.trim() || null;
  }

  async send(params: {
    to: string[];
    body: string;
    senderId?: string | null;
    callbackUrl?: string;
  }): Promise<SmsSendResult> {
    if (!this.configured) {
      return { accepted: false, providerMessageId: null, error: this.blocker, cost: null };
    }

    const senderId = params.senderId ?? this.senderId;
    if (!senderId) {
      return {
        accepted: false,
        providerMessageId: null,
        error: 'No sender ID is configured. Set SMS_SENDER_ID in the environment.',
        cost: null,
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/sms/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: this.apiKey,
          to: params.to[0],
          from: senderId,
          sms: params.body,
          type: 'plain',
          channel: 'generic',
          ...(params.callbackUrl ? { webhook_url: params.callbackUrl } : {}),
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        message_id?: string;
        code?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        return {
          accepted: false,
          providerMessageId: null,
          error: `Termii rejected the request (HTTP ${response.status}).`,
          cost: null,
          raw: payload,
        };
      }

      if (!payload?.message_id) {
        return {
          accepted: false,
          providerMessageId: null,
          error: payload?.message ?? 'Termii accepted the request but returned no message id.',
          cost: null,
          raw: payload,
        };
      }

      return {
        accepted: true,
        providerMessageId: payload.message_id,
        error: null,
        cost: null,
        raw: payload,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      return {
        accepted: false,
        providerMessageId: null,
        error: `Could not reach Termii: ${message}. The outcome is uncertain - reconcile before resending.`,
        cost: null,
      };
    }
  }

  async getCreditBalance(): Promise<SmsCreditBalance> {
    return {
      available: false,
      balance: null,
      currency: null,
      reason:
        'Termii does not expose a credit balance through the send endpoint this client uses. ' +
        'Credits are unknown rather than estimated.',
    };
  }
}

/* ------------------------------------------------------------------ *
 * Client
 * ------------------------------------------------------------------ */

let cached: SmsGatewayClient | null = null;

/**
 * The configured gateway, built once.
 *
 * A caller that cannot reach a provider gets a client whose `configured` is
 * false and whose `blocker` explains what to set, rather than an exception - so
 * the SMS Centre can render a truthful "sending unavailable" instead of a 500.
 */
export function getSmsGateway(): SmsGatewayClient {
  if (cached) return cached;

  const { provider, blocker } = resolveProvider();
  cached = provider === 'termii' ? new TermiiClient(blocker) : new AfricasTalkingClient(blocker);
  return cached;
}

/** Clears the cached client, so a settings change can be picked up. */
export function resetSmsGateway(): void {
  cached = null;
}

/* ------------------------------------------------------------------ *
 * Delivery callbacks
 * ------------------------------------------------------------------ */

/**
 * Normalises a provider delivery report.
 *
 * Africa's Talking posts one report per recipient with a `status` of `Success`
 * or `Failed`; Termii delivers a JSON body whose status is passed through as
 * delivered/failed. Both are mapped onto the same two outcomes, with anything
 * unrecognised reported as `unknown` rather than guessed - a status the platform
 * does not understand is not a delivery.
 */
export function normaliseDeliveryReport(
  provider: SmsProviderName,
  body: Record<string, unknown>
): SmsDeliveryReport | null {
  const id =
    (body.id as string | undefined) ??
    (body.messageId as string | undefined) ??
    (body.message_id as string | undefined);
  if (!id) return null;

  if (provider === 'africastalking') {
    const status = String(body.status ?? '').toLowerCase();
    if (status === 'success') {
      return { providerMessageId: String(id), status: 'delivered', failureReason: null };
    }
    if (status === 'failed' || status === 'rejected') {
      return {
        providerMessageId: String(id),
        status: 'failed',
        failureReason: (body.failureReason as string | undefined) ?? null,
      };
    }
  } else {
    const status = String(body.status ?? '').toLowerCase();
    if (status === 'delivered') {
      return { providerMessageId: String(id), status: 'delivered', failureReason: null };
    }
    if (status === 'failed' || status === 'rejected') {
      return {
        providerMessageId: String(id),
        status: 'failed',
        failureReason: (body.failureReason as string | undefined) ?? null,
      };
    }
  }

  return { providerMessageId: String(id), status: 'unknown', failureReason: null };
}
