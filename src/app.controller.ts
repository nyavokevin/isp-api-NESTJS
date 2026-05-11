import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';

@Controller()
export class AppController {
  @Get('generate_204')
  generate204(@Res() res: Response) {
    res.status(204).send();
  }

  @Get('hotspot-detect.html')
  hotspotDetect(@Res() res: Response) {
    res.type('html').send('<HTML><HEAD><TITLE>Success</TITLE></HEAD><BODY>Success</BODY></HTML>');
  }
}