export interface IHttpRequestHandler {
  query(request: IHttpRequest, responseSender: IHttpResponseSender);
}

export interface IHttpRequest {
  relativeUrl: string;
  body: string;
}

export interface IHttpResponseSender {
  sendStatusCode(code: number, message?: string): void;
  sendHeader(key: string, value: string): void;
  sendBody(body: string): void;
  finishResponse(): void;
}
