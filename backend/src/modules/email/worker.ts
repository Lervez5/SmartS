import { Worker } from "bullmq";
import { connection } from "../../shared/redis";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export const emailWorker = new Worker("email-queue", async (job) => {
  const { to, type, payload } = job.data;
  
  console.log(`[EmailWorker] Sending \${type} email to \${to}...`);

  if (type === "invitation") {
    const { name, role, activationLink } = payload;
    
    if (resend) {
      await resend.emails.send({
        from: 'SmartSprout <onboarding@smartsprout.com>',
        to: [to],
        subject: 'Welcome to SmartSprout! Activate your account',
        html: `
          <h1>Welcome to SmartSprout, \${name}!</h1>
          <p>You have been invited to join as a <strong>\${role}</strong>.</p>
          <p>Please click the link below to activate your account and set your password:</p>
          <a href="\${activationLink}">\${activationLink}</a>
          <p>This link will expire in 7 days.</p>
        `
      });
    } else {
      console.log(`
        MOCK EMAIL SENT:
        To: \${to}
        Subject: Welcome to SmartSprout
        Link: \${activationLink}
      `);
    }
  }

  // Update EmailLog in DB if needed
}, { connection });

emailWorker.on("completed", (job) => {
  console.log(`[EmailWorker] Job \${job.id} completed!`);
});

emailWorker.on("failed", (job, err) => {
  console.error(`[EmailWorker] Job \${job?.id} failed: \${err.message}`);
});
