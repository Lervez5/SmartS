import { Request, Response } from "express";
import { activateAccountService, validateInvitationService, getInvitationListService } from "./service";

export async function validateInvitationController(req: Request, res: Response) {
  const { token } = req.params;
  const invitation = await validateInvitationService(token);
  res.json({ 
    email: invitation.user.email,
    name: invitation.user.name,
    role: invitation.user.role
  });
}

export async function activateAccountController(req: Request, res: Response) {
  const { token } = req.params;
  const { password } = req.body;

  if (!password || password.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters long" });
  }

  await activateAccountService(token, password);
  res.json({ message: "Account activated successfully" });
}

export async function listInvitationsController(_req: Request, res: Response) {
  const invitations = await getInvitationListService();
  res.json({ invitations });
}
