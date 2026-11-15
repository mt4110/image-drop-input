const net = require("node:net");

const destination = "veil-image-onboarding-control.test:443";
if (!process.env.HTTPS_PROXY) process.exit(0);
const proxy = new URL(process.env.HTTPS_PROXY);
if (!["127.0.0.1", "localhost"].includes(proxy.hostname) || !proxy.username || !proxy.password) {
  process.exit(0);
}
const auth = Buffer.from(`${proxy.username}:${proxy.password}`).toString("base64");
const socket = net.createConnection({host: proxy.hostname, port: Number(proxy.port)});
let response = "";
socket.setTimeout(5000, () => socket.destroy(new Error("CONNECT timed out")));
socket.on("connect", () => socket.write(
  `CONNECT ${destination} HTTP/1.1\r\nHost: ${destination}\r\nProxy-Authorization: Basic ${auth}\r\n\r\n`
));
socket.setEncoding("ascii");
socket.on("data", chunk => {
  response += chunk;
  if (!response.includes("\r\n")) return;
  const status = response.split("\r\n")[0];
  console.log(`Control CONNECT ${destination}: ${status}`);
  if (!status.startsWith("HTTP/1.1 403 ")) process.exitCode = 1;
  socket.destroy();
});
socket.on("end", () => {
  if (!response.includes("\r\n")) process.exitCode = 1;
});
