import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

@Injectable()
export class AiService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async chat(message: string, history: ChatCompletionMessageParam[] = []) {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        ...history,
        { role: 'user', content: message },
      ],
    });

    return {
      message: 'Success',
      data: {
        reply: response.choices[0].message.content,
        model: response.model,
        usage: response.usage,
        finishReason: response.choices[0].finish_reason,
      },
    };
  }

  async streamChat(
    message: string,
    history: ChatCompletionMessageParam[] = [],
  ) {
    const stream = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        ...history,
        { role: 'user', content: message },
      ],
      stream: true,
    });

    return stream;
  }
}
