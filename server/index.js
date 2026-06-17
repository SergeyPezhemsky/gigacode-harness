import { createServer } from "./src/app.js";
import { port } from "./src/config.js";

const app = createServer();

app.listen(port, () => {
  console.log(`GigaCode-Harness API listening on http://localhost:${port}`);
});
