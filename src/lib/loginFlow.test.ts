import { describe, expect, it } from 'vitest';
import { afterLogin, isAuthDialog, type Dialog, type LoginContext } from './loginFlow';

const ctx = (patch: Partial<LoginContext> = {}): LoginContext => ({ isAdmin: false, shopClosed: false, profileComplete: true, ...patch });

describe('afterLogin', () => {
  it('returns to the page after a plain login, whatever the profile or shop state', () => {
    expect(afterLogin('auth', ctx())).toEqual({ dialog: 'none' });
    expect(afterLogin('auth', ctx({ profileComplete: false, shopClosed: true }))).toEqual({ dialog: 'none' });
  });

  it('continues to checkout after a login that started at checkout', () => {
    expect(afterLogin('checkoutAuth', ctx())).toEqual({ dialog: 'cart' });
    expect(afterLogin('checkoutAuth', ctx({ profileComplete: false }))).toEqual({ dialog: 'profile' });
  });

  it('closes the prompt (never leaves it open) when the shop is closed', () => {
    expect(afterLogin('checkoutAuth', ctx({ shopClosed: true }))).toEqual({ dialog: 'none' });
  });

  it('opens the admin portal for the owner and refuses everyone else', () => {
    expect(afterLogin('adminAuth', ctx({ isAdmin: true }))).toEqual({ dialog: 'admin' });
    expect(afterLogin('adminAuth', ctx())).toEqual({ dialog: 'none', adminDenied: true });
  });

  it('leaves every other dialog alone', () => {
    for (const d of ['none', 'profile', 'cart', 'admin', 'myOrders'] as Dialog[]) expect(afterLogin(d, ctx())).toBeNull();
  });

  it('never keeps a sign-in prompt open', () => {
    for (const d of ['auth', 'checkoutAuth', 'adminAuth'] as Dialog[]) {
      for (const isAdmin of [true, false]) {
        for (const shopClosed of [true, false]) {
          for (const profileComplete of [true, false]) {
            const next = afterLogin(d, { isAdmin, shopClosed, profileComplete });
            expect(next && isAuthDialog(next.dialog)).toBeFalsy();
          }
        }
      }
    }
  });
});
