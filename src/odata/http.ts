export interface IHttpRequestHandler {
  query(request: IHttpRequest);
}

export interface IHttpRequest {
  relativeUrl: string;
  body: string;
}

export interface IHttpResponseSender {
  sendStatusCode(code: number): void;
  sendHeader(key: string, value: string): void;
  sendBody(body: string): void;
  finishResponse(): void;
}
