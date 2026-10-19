// Déclaration ambiante minimale pour « pg ».
//
// Le paquet « pg » résout son point d'entrée ESM (esm/index.mjs) sans
// fichier de types local, ce qui provoquait une erreur TS7016 dans les
// tests d'intégration. On ne dépend donc pas d'une nouvelle dépendance :
// on décrit ici la petite surface réellement utilisée (Client et query).
declare module 'pg' {
  export interface QueryResult<T = Record<string, unknown>> {
    rows: T[];
    rowCount: number | null;
  }

  export interface ClientConfig {
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    database?: string;
    connectionString?: string;
  }

  export class Client {
    constructor(config?: ClientConfig);
    connect(): Promise<void>;
    end(): Promise<void>;
    query<T = Record<string, unknown>>(
      text: string,
      params?: unknown[],
    ): Promise<QueryResult<T>>;
  }

  const pg: { Client: typeof Client };
  export default pg;
}
