// src/ai/ai.controller.ts
import { Controller, Post, Body, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AiService } from './ai.service';
import { Public } from 'src/auth/decorators/public.decorator';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  @Public()
  async chat(
    @Body() body: { message: string; history?: ChatCompletionMessageParam[] },
  ) {
    return this.aiService.chat(body.message, body.history ?? []);
  }

  @Post('stream')
  @Public()
  async stream(
    @Body() body: { message: string; history?: ChatCompletionMessageParam[] },
    @Res() res: Response,
  ) {
    const stream = await this.aiService.streamChat(
      body.message,
      body.history ?? [],
    );

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content ?? '';
      if (token) {
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  }
}
