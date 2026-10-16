// Type-only contract for checking Edge sources with tsc when Deno cannot access its cache.
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};
