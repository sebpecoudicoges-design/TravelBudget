import { adminClient } from "../_shared/account-data.ts";
import { writePersonalDocument } from "./handler.ts";

Deno.serve((req) => writePersonalDocument(req, adminClient));
