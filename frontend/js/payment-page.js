import { mountShell } from "./site-shell.js";
import { requireAuthOrRedirect } from "./auth.js";

mountShell("payment");
requireAuthOrRedirect();
