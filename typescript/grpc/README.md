## Run Client and Server

This exercise uses `@grpc/grpc-js` and `@grpc/proto-loader`, so no generated
stub files are checked in.

```bash
npx tsx grpc/server.ts
npx tsx grpc/client.ts
```

The server listens on `[::]:50051` by default. The client connects to
`localhost:50051` by default. Use `--address` on the server or `--target` on
the client to change it.

![server](../media/grpc/server.png)
![client](../media/grpc/client.png)
