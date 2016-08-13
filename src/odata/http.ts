export interface IHttpRequestHandler {
  query(request: IHttpRequest, responseSender: IHttpResponseSender);
}

export interface IHttpRequest {
  relativeUrl: string;
  body: string;
}

export interface IHttpResponseSender {
  sendBody(body: string);
  finishResponse();
}