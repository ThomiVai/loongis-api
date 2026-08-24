import "dotenv/config";

import { app } from "./app";
import { connectDatabase } from "./config/database";

const port =
  Number(
    process.env.PORT ??
      3000,
  );

async function startServer(): Promise<void> {
  try {
    await connectDatabase();

    app.listen(
      port,
      "0.0.0.0",
      () => {
        console.log(
          `Servidor de Loongis funcionando en el puerto ${port}`,
        );
      },
    );
  } catch (error) {
    console.error(
      "No se pudo iniciar el servidor:",
      error,
    );

    process.exit(1);
  }
}

void startServer();