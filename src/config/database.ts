import dns from "node:dns";

import mongoose from "mongoose";

/* ========================================
   DNS
======================================== */

function configureDns(): void {
  const dnsServers =
    process.env.DNS_SERVERS;

  if (!dnsServers) {
    return;
  }

  const servers =
    dnsServers
      .split(",")
      .map((server) =>
        server.trim(),
      )
      .filter(Boolean);

  if (
    servers.length === 0
  ) {
    return;
  }

  dns.setServers(
    servers,
  );

  console.log(
    `DNS configurado para Node: ${servers.join(", ")}`,
  );
}

/* ========================================
   DATABASE
======================================== */

export async function connectDatabase(): Promise<void> {
  const mongoUri =
    process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error(
      "La variable de entorno MONGO_URI no está definida.",
    );
  }

  configureDns();

  await mongoose.connect(
    mongoUri,
  );

  console.log(
    "MongoDB conectado correctamente.",
  );
}