/** Which dialog is open. The two `*Auth` ones are the Google sign-in prompt, opened for a different reason. */
export type Dialog =
  | 'none' | 'auth' | 'checkoutAuth' | 'profile' | 'cart' | 'adminAuth' | 'admin' | 'myOrders';

/** The sign-in prompts: dialogs that only make sense while nobody is signed in. */
export const isAuthDialog = (d: Dialog) => d === 'auth' || d === 'checkoutAuth' || d === 'adminAuth';

export interface LoginContext {
  isAdmin: boolean;
  shopClosed: boolean;
  profileComplete: boolean;
}

/**
 * Called once someone is signed in (and their profile/admin status is loaded) while a sign-in prompt is open.
 * Returns what to show next, or null when no sign-in prompt is open. The prompt is always closed:
 * - plain login from the header: back to the page;
 * - login on the way to checkout: continue (contact details first if missing), unless the shop is closed;
 * - owner login: the admin portal, or back to the page with `adminDenied` for any other account.
 */
export function afterLogin(dialog: Dialog, ctx: LoginContext): { dialog: Dialog; adminDenied?: true } | null {
  switch (dialog) {
    case 'auth':
      return { dialog: 'none' };
    case 'checkoutAuth':
      if (ctx.shopClosed) return { dialog: 'none' };
      return { dialog: ctx.profileComplete ? 'cart' : 'profile' };
    case 'adminAuth':
      return ctx.isAdmin ? { dialog: 'admin' } : { dialog: 'none', adminDenied: true };
    default:
      return null;
  }
}
