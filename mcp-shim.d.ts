declare module "@modelcontextprotocol/sdk/client/index.js" {
  export type Client = any;
}

declare module "*.md?raw" {
  const content: string;
  export default content;
}
