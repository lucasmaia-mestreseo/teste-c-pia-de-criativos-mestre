/**
 * Company e-mail domains allowed to sign up, log in and be invited.
 * Keep in sync with ALLOWED_DOMAINS in supabase/functions/invite-user/index.ts.
 */
export const ALLOWED_EMAIL_DOMAINS = ['mestreseo.com.br', 'agenciamestre.com'];

export const isAllowedEmail = (email: string) => {
  const domain = email.trim().toLowerCase().split('@')[1] ?? '';
  return ALLOWED_EMAIL_DOMAINS.includes(domain);
};

/** "@mestreseo.com.br ou @agenciamestre.com" */
export const allowedDomainsLabel = ALLOWED_EMAIL_DOMAINS.map((d) => `@${d}`).join(' ou ');
