
export class ApiResponse {
  public success: boolean;
  constructor(
    public statusCode: number,
    public message: string,
    public data: any = null
  ) {
    this.success = statusCode >= 200 && statusCode < 300;
  }
}

export const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
