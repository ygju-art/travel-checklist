export async function onRequest(ctx: any) {
    const url = new URL(ctx.request.url);
    const returnTo = url.origin; // 로그아웃 후 돌아올 위치
    const logoutURL = `${ctx.env.ACCESS_LOGOUT_URL}?returnTo=${encodeURIComponent(returnTo)}`;
    return Response.redirect(logoutURL, 302);
  }
  