import catalog from "../data/catalog.json";
import type { Catalog } from "../data/types";
import { buildModel, type CatalogPart } from "./model";

const CHUNK = 400;

const model = buildModel(catalog as unknown as Catalog);
const { entries, locsById, ...meta } = model;
void locsById;
const send = (part: CatalogPart) => postMessage(part);
send({ kind: "meta", model: meta });
for (let index = 0; index < entries.length; index += CHUNK) send({ kind: "chunk", entries: entries.slice(index, index + CHUNK) });
send({ kind: "done" });
