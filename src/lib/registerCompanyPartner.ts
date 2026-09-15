import type { SupabaseClient } from "@supabase/supabase-js";
import { createEphemeralSupabaseAuthClient } from "@/lib/createSubUser";
import {
  REGISTRATION_PASSWORD_MIN_LENGTH,
  signUpStudentWithChosenPassword,
} from "@/lib/registrationPassword";
import { signInStudentWithPassword } from "@/lib/studentAuthLogin";

export type CompanyRegistrationInput = {
  contact_name: string;
  designation: string;
  email: string;
  phone: string;
  company_name: string;
  gst_number: string;
  company_address: string;
  password: string;
  email_verified: boolean;
};

function friendlyCompanyRegisterError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err || "");
  const low = msg.toLowerCase();
  if (low.includes("register_company_partner") && low.includes("could not find")) {
    return "Company registration is not set up on the database yet. Contact Apna Intern support.";
  }
  if (low.includes("sign in required")) {
    return "Could not finish registration. Confirm your email or try again from Company Login.";
  }
  if (low.includes("already registered") || low.includes("duplicate")) {
    return "This email is already registered. Use Company Login if you have an account.";
  }
  if (msg.trim()) return msg;
  return "Company registration failed. Please try again.";
}

export async function registerCompanyPartner(
  directoryClient: SupabaseClient,
  input: CompanyRegistrationInput
): Promise<{ userId: string }> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const password = input.password.trim();
  if (password.length < REGISTRATION_PASSWORD_MIN_LENGTH) {
    throw new Error(`Password must be at least ${REGISTRATION_PASSWORD_MIN_LENGTH} characters`);
  }
  if (!input.email_verified) {
    throw new Error("Please verify your email with the OTP before submitting.");
  }

  const authClient = createEphemeralSupabaseAuthClient();
  const { userId } = await signUpStudentWithChosenPassword(authClient, directoryClient, {
    email: normalizedEmail,
    password,
    fullName: input.contact_name.trim(),
  });

  const signIn = await signInStudentWithPassword(authClient, normalizedEmail, password);
  if (!signIn.ok) {
    throw new Error(
      signIn.error instanceof Error
        ? signIn.error.message
        : "Account was created but sign-in failed. Try Company Login."
    );
  }

  const { data, error } = await authClient.rpc("register_company_partner", {
    p_user_id: userId,
    p_contact_name: input.contact_name.trim(),
    p_designation: input.designation.trim(),
    p_email: normalizedEmail,
    p_phone: input.phone.trim(),
    p_company_name: input.company_name.trim(),
    p_gst_number: input.gst_number.trim(),
    p_company_address: input.company_address.trim(),
    p_email_verified: input.email_verified,
  });

  if (error) throw new Error(friendlyCompanyRegisterError(error));
  if (data && typeof data === "object" && (data as { ok?: boolean }).ok !== true) {
    throw new Error("Company profile could not be saved.");
  }

  return { userId };
}
