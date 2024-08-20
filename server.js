import { connect } from "amqplib";
import bodyParser from "body-parser";
import express from "express";
import { v4 as uuidv4 } from "uuid";

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// Conectar ao servidor RabbitMQ
async function main() {
  const connection = await connect("amqp://localhost");
  const channel = await connection.createChannel();

  // Criar a fila de espera
  await channel.assertQueue("fila_espera");

  // Criar a fila de registro de saídas
  await channel.assertQueue("fila_saidas");

  // Criar o roteador para adicionar usuários na fila
  app.post("/adicionar_fila", async (req, res) => {
    const { nome } = req.body;
    const id = uuidv4(); // Gere um ID único para o usuário
    channel.sendToQueue(
      "fila_espera",
      Buffer.from(JSON.stringify({ nome, status: "esperando" })),
      { correlationId: id }
    );
    res.send("Usuário adicionado na fila de espera");
  });

  // Criar o roteador para remover usuários da fila
  app.delete("/remover_fila", async (req, res) => {
    const { id } = req.body;
    const message = await channel.get("fila_espera", { noAck: false });
    if (message && message.properties.correlationId === id) {
      channel.ack(message);
      channel.sendToQueue(
        "fila_saidas",
        Buffer.from(
          JSON.stringify({ nome: message.content.toString(), status: "saiu" })
        )
      );
      res.send("Usuário removido da fila de espera");
    } else {
      res.status(404).send("Usuário não encontrado na fila de espera");
    }
  });

  // Criar o roteador para atualizar o status do usuário para "cortando cabelo"
  app.put("/cortar_cabelo", async (req, res) => {
    const { id } = req.body;
    const message = await channel.get("fila_espera", { noAck: false });
    if (message && message.properties.correlationId === id) {
      channel.ack(message);
      channel.sendToQueue(
        "fila_espera",
        Buffer.from(
          JSON.stringify({
            nome: message.content.toString(),
            status: "cortando_cabelo",
          })
        )
      );
      res.send("Usuário está cortando cabelo");
    } else {
      res.status(404).send("Usuário não encontrado na fila de espera");
    }
  });

  // Criar o roteador para obter o status do usuário
  app.get("/status", async (req, res) => {
    const { nome } = req.query;
    const message = await channel.get("fila_espera");
    if (
      message &&
      message.content.toString() ===
        JSON.stringify({ nome, status: "esperando" })
    ) {
      res.send("Usuário está esperando");
    } else if (
      message &&
      message.content.toString() ===
        JSON.stringify({ nome, status: "cortando_cabelo" })
    ) {
      res.send("Usuário está cortando cabelo");
    } else {
      res.status(404).send("Usuário não encontrado na fila de espera");
    }
  });

  // Iniciar o servidor HTTP
  app.listen(3000, () => {
    console.log("Servidor HTTP iniciado na porta 3000");
  });
}

main().catch(console.error);
