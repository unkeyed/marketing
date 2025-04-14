# Unkey Playground

## Local Development

### Adding required environment variables

Log in to the [Unkey dashboard](https://app.unkey.com) and create a new API. Copy the API ID and then create a Root Key and paste them into the following environment variables:

```
NEXT_PUBLIC_PLAYGROUND_API_ID=
PLAYGROUND_ROOT_KEY=
```

To start the local development server, run the following command from the monorepo root:

```bash
pnpm run playground:dev
```

or from the play directory:
```bash
pnpm run dev
```
