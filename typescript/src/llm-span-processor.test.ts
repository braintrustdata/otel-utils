import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { trace, context } from '@opentelemetry/api';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { LLMSpanProcessor } from './llm-span-processor';

describe('Basic OpenTelemetry Setup', () => {
  let memoryExporter: InMemorySpanExporter;
  let provider: BasicTracerProvider;
  let tracer: any;

  beforeEach(() => {
    memoryExporter = new InMemorySpanExporter();
    provider = new BasicTracerProvider();

    // Add a simple processor first to verify spans are created
    const simpleProcessor = new SimpleSpanProcessor(memoryExporter);
    provider.addSpanProcessor(simpleProcessor);
    provider.register();
    tracer = provider.getTracer('test_tracer');
  });

  afterEach(async () => {
    await provider.shutdown();
    memoryExporter.reset();
  });

  it('should create a basic span', () => {
    const span = tracer.startSpan('test_operation');
    span.end();

    const spans = memoryExporter.getFinishedSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0].name).toBe('test_operation');
  });

  it('should create parent-child spans', () => {
    const rootSpan = tracer.startSpan('root');

    // Use the span context directly
    const parentContext = trace.setSpanContext(context.active(), rootSpan.spanContext());
    const childSpan = tracer.startSpan('child', {}, parentContext);

    childSpan.end();
    rootSpan.end();

    const spans = memoryExporter.getFinishedSpans();
    expect(spans).toHaveLength(2);

    const child = spans.find((s) => s.name === 'child');
    const parent = spans.find((s) => s.name === 'root');

    // Verify they're in the same trace
    expect(child?.spanContext().traceId).toBe(parent?.spanContext().traceId);
    // Verify child has parent
    expect(child?.parentSpanId).toBe(parent?.spanContext().spanId);
  });
});

describe('LLMSpanProcessor', () => {
  let memoryExporter: InMemorySpanExporter;
  let provider: BasicTracerProvider;
  let llmProcessor: LLMSpanProcessor;
  let tracer: any;

  beforeEach(() => {
    memoryExporter = new InMemorySpanExporter();
    provider = new BasicTracerProvider();

    // Create processor with our filtering logic
    const baseProcessor = new SimpleSpanProcessor(memoryExporter);
    llmProcessor = new LLMSpanProcessor(baseProcessor);

    provider.addSpanProcessor(llmProcessor);
    provider.register();
    tracer = provider.getTracer('test_tracer');
  });

  afterEach(async () => {
    await provider.shutdown();
    memoryExporter.reset();
  });

  it('should keep root spans', () => {
    const span = tracer.startSpan('root_operation');
    span.end();

    const spans = memoryExporter.getFinishedSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0].name).toBe('root_operation');
  });

  it('should keep LLM spans and drop non-LLM spans', () => {
    const rootSpan = tracer.startSpan('root');

    const parentContext = trace.setSpanContext(context.active(), rootSpan.spanContext());
    const llmSpan = tracer.startSpan('gen_ai.completion', {}, parentContext);
    const regularSpan = tracer.startSpan('database_query', {}, parentContext);

    llmSpan.end();
    regularSpan.end();
    rootSpan.end();

    const spans = memoryExporter.getFinishedSpans();
    const spanNames = spans.map((s) => s.name);

    expect(spanNames).toContain('root'); // root span kept
    expect(spanNames).toContain('gen_ai.completion'); // LLM span kept
    expect(spanNames).not.toContain('database_query'); // non-LLM span dropped
  });

  it('should keep spans with LLM attributes', () => {
    const rootSpan = tracer.startSpan('root');

    const parentContext = trace.setSpanContext(context.active(), rootSpan.spanContext());
    const attrSpan = tracer.startSpan('some_operation', {}, parentContext);
    attrSpan.setAttributes({ 'gen_ai.model': 'gpt-4' });

    const regularSpan = tracer.startSpan('third_operation', {}, parentContext);
    regularSpan.setAttributes({ 'database.connection': 'postgres' });

    attrSpan.end();
    regularSpan.end();
    rootSpan.end();

    const spans = memoryExporter.getFinishedSpans();
    const spanNames = spans.map((s) => s.name);

    expect(spanNames).toContain('root');
    expect(spanNames).toContain('some_operation'); // has gen_ai attribute
    expect(spanNames).not.toContain('third_operation'); // no LLM attributes
  });
});
