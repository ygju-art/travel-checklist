// Access 로그인 플로우 유도
export async function onRequest() {
    return Response.redirect("/api/me", 302);
  }
  