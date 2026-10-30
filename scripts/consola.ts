/** Utilidades para leer datos en la consola desde los scripts. */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

export async function preguntar(texto: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  const respuesta = await rl.question(texto);
  rl.close();
  return respuesta;
}

/** Lee una línea sin mostrarla (muestra * por cada carácter). */
export function preguntarOculto(texto: string): Promise<string> {
  return new Promise((resolver) => {
    stdout.write(texto);
    if (!stdin.isTTY) {
      // Entrada redirigida: no se puede ocultar
      void preguntar("").then(resolver);
      return;
    }
    let valor = "";
    stdin.setRawMode(true);
    stdin.setEncoding("utf8");
    stdin.resume();

    const alTeclear = (datos: string) => {
      for (const c of datos) {
        if (c === "\r" || c === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", alTeclear);
          stdout.write("\n");
          resolver(valor);
          return;
        }
        if (c === "\u0003") {
          stdout.write("\n");
          process.exit(130); // Ctrl+C
        }
        if (c === "\u007f" || c === "\b") {
          if (valor) {
            valor = valor.slice(0, -1);
            stdout.write("\b \b");
          }
          continue;
        }
        valor += c;
        stdout.write("*");
      }
    };
    stdin.on("data", alTeclear);
  });
}
