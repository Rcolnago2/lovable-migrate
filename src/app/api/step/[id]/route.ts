import { NextRequest } from 'next/server';
import { MigrationConfig, LogLine } from '@/lib/types';

export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const stepId = parseInt(id, 10);

  const body = await req.json();
  const cfg: MigrationConfig = body.config;
  const csvContent: string | undefined = body.csvContent;
  const csvFiles: Array<{ name: string; content: string }> | undefined = body.csvFiles;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function emit(line: LogLine) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(line)}\n\n`));
      }

      try {
        const {
          runStep1, runStep2, runStep3, runStep4,
          runStep5, runStep6, runStep7,
        } = await import('@/lib/runner');

        let result: unknown;
        if (stepId === 1) result = await runStep1(cfg, emit);
        else if (stepId === 2) result = await runStep2(cfg, emit);
        else if (stepId === 3) result = await runStep3(cfg, emit);
        else if (stepId === 4) result = await runStep4(cfg, emit, csvContent || '');
        else if (stepId === 5) result = await runStep5(cfg, emit);
        else if (stepId === 6) result = await runStep6(cfg, emit, csvFiles || []);
        else if (stepId === 7) result = await runStep7(cfg, emit);

        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: 'done', result })}\n\n`
        ));
      } catch (err: unknown) {
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: 'error', text: (err as Error).message })}\n\n`
        ));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
