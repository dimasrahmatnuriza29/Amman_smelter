import snowflake, { Connection, ConnectionOptions } from "snowflake-sdk";

// Reduce SDK log noise
snowflake.configure({ logLevel: "ERROR" });

let cachedConnection: Connection | null = null;

function getConnectionOptions(): ConnectionOptions {
  const {
    SNOWFLAKE_ACCOUNT,
    SNOWFLAKE_USER,
    SNOWFLAKE_PASSWORD,
    SNOWFLAKE_WAREHOUSE,
    SNOWFLAKE_DATABASE,
    SNOWFLAKE_SCHEMA,
    SNOWFLAKE_ROLE,
  } = process.env;

  if (!SNOWFLAKE_ACCOUNT || !SNOWFLAKE_USER || !SNOWFLAKE_PASSWORD) {
    throw new Error(
      "Missing Snowflake credentials. Please set SNOWFLAKE_ACCOUNT, SNOWFLAKE_USER, SNOWFLAKE_PASSWORD in .env.local"
    );
  }

  return {
    account: SNOWFLAKE_ACCOUNT,
    username: SNOWFLAKE_USER,
    password: SNOWFLAKE_PASSWORD,
    warehouse: SNOWFLAKE_WAREHOUSE,
    database: SNOWFLAKE_DATABASE,
    schema: SNOWFLAKE_SCHEMA,
    role: SNOWFLAKE_ROLE,
  };
}

function connect(): Promise<Connection> {
  return new Promise((resolve, reject) => {
    if (cachedConnection && cachedConnection.isUp()) {
      resolve(cachedConnection);
      return;
    }

    const connection = snowflake.createConnection(getConnectionOptions());
    connection.connect((err, conn) => {
      if (err) {
        reject(err);
        return;
      }
      cachedConnection = conn;
      resolve(conn);
    });
  });
}

export async function querySnowflake<T = Record<string, unknown>>(
  sqlText: string,
  binds: (string | number | boolean | null)[] = []
): Promise<T[]> {
  const connection = await connect();

  return new Promise((resolve, reject) => {
    connection.execute({
      sqlText,
      binds,
      complete: (err, _stmt, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve((rows ?? []) as T[]);
      },
    });
  });
}
