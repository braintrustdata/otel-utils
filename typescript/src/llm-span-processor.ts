import { Context } from '@opentelemetry/api';
import { SpanProcessor, ReadableSpan, Span } from '@opentelemetry/sdk-trace-base';

const LLM_PREFIXES = ['gen_ai.', 'braintrust.', 'llm.', 'ai'] as const;

/**
 * A span processor that filters spans to only export LLM-related telemetry.
 *
 * Only LLM-related spans and root spans will be forwarded to the inner processor.
 * This dramatically reduces telemetry volume while preserving LLM observability.
 *
 * @example
 * ```typescript
 * const processor = new LLMSpanProcessor(new BatchSpanProcessor(new OTLPTraceExporter()));
 * const provider = new TracerProvider();
 * provider.addSpanProcessor(processor);
 * ```
 */
export class LLMSpanProcessor implements SpanProcessor {
  private readonly processor: SpanProcessor;

  /**
   * Initialize the LLM span processor.
   *
   * @param processor - The wrapped span processor that will receive filtered spans
   */
  constructor(processor: SpanProcessor) {
    this.processor = processor;
  }

  /**
   * Forward span start events to the inner processor.
   */
  onStart(span: Span, parentContext: Context): void {
    this.processor.onStart(span, parentContext);
  }

  /**
   * Apply filtering logic and conditionally forward span end events.
   */
  onEnd(span: ReadableSpan): void {
    if (this.shouldKeepLlmSpan(span)) {
      this.processor.onEnd(span);
    }
  }

  /**
   * Shutdown the inner processor.
   */
  shutdown(): Promise<void> {
    return this.processor.shutdown();
  }

  /**
   * Force flush the inner processor.
   */
  forceFlush(): Promise<void> {
    return this.processor.forceFlush();
  }

  /**
   * Determine if a span should be kept based on LLM filtering criteria.
   *
   * Keep spans if:
   * 1. It's a root span (no parent)
   * 2. Span name starts with 'gen_ai.', 'braintrust.', 'llm.', or 'ai'
   * 3. Any attribute name starts with those prefixes
   */
  private shouldKeepLlmSpan(span: ReadableSpan): boolean {
    if (!span) {
      return false;
    }

    // Braintrust requires root spans, so always keep them
    if (!span.parentSpanId) {
      return true;
    }

    // Check span name
    if (LLM_PREFIXES.some((prefix) => span.name.startsWith(prefix))) {
      return true;
    }

    // Check attribute names
    const attributes = span.attributes;
    if (attributes) {
      const attributeNames = Object.keys(attributes);
      if (attributeNames.some((name) => LLM_PREFIXES.some((prefix) => name.startsWith(prefix)))) {
        return true;
      }
    }

    return false;
  }
}
