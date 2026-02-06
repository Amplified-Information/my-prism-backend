import { Request, Response, NextFunction } from 'express';
declare const marketMiddleware: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export default marketMiddleware;
export declare const config: {
    matcher: string[];
};
//# sourceMappingURL=index.d.ts.map