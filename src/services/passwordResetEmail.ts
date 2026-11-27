type PasswordResetEmail = {
  apiKey: string;
  from: string;
  to: string;
  resetUrl: string;
};

export async function sendPasswordResetEmail({
  apiKey,
  from,
  to,
  resetUrl,
}: PasswordResetEmail): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Restablecé tu contraseña de Loongis",
      text:
        "Recibimos una solicitud para restablecer la contraseña del panel de Loongis. " +
        "Abrí este enlace dentro de los próximos 30 minutos: " +
        resetUrl +
        "\n\nSi no fuiste vos, podés ignorar este email.",
      html:
        "<p>Recibimos una solicitud para restablecer la contraseña del panel de Loongis.</p>" +
        '<p><a href="' +
        resetUrl +
        '">Crear una nueva contraseña</a></p>' +
        "<p>El enlace vence en 30 minutos. Si no fuiste vos, podés ignorar este email.</p>",
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error("El proveedor rechazó el email de recuperación.");
  }
}
