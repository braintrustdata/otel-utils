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

  it('should keep spans with LLM name prefixes', () => {
    const rootSpan = tracer.startSpan('root');

    const parentContext = trace.setSpanContext(context.active(), rootSpan.spanContext());
    const genAiSpan = tracer.startSpan('gen_ai.completion', {}, parentContext);
    const braintrustSpan = tracer.startSpan('braintrust.eval', {}, parentContext);
    const llmSpan = tracer.startSpan('llm.generate', {}, parentContext);
    const aiSpan = tracer.startSpan('ai_model_call', {}, parentContext);
    const regularSpan = tracer.startSpan('database_query', {}, parentContext);

    genAiSpan.end();
    braintrustSpan.end();
    llmSpan.end();
    aiSpan.end();
    regularSpan.end();
    rootSpan.end();

    const spans = memoryExporter.getFinishedSpans();
    const spanNames = spans.map((s) => s.name);

    expect(spanNames).toContain('root');
    expect(spanNames).toContain('gen_ai.completion');
    expect(spanNames).toContain('braintrust.eval');
    expect(spanNames).toContain('llm.generate');
    expect(spanNames).toContain('ai_model_call');
    expect(spanNames).not.toContain('database_query');
  });

  it('should keep spans with LLM attribute prefixes', () => {
    const rootSpan = tracer.startSpan('root');

    const parentContext = trace.setSpanContext(context.active(), rootSpan.spanContext());
    const genAiAttrSpan = tracer.startSpan('gen_ai_attr_operation', {}, parentContext);
    genAiAttrSpan.setAttributes({ 'gen_ai.model': 'gpt-4' });

    const braintrustAttrSpan = tracer.startSpan('braintrust_attr_operation', {}, parentContext);
    braintrustAttrSpan.setAttributes({ 'braintrust.dataset': 'test-data' });

    const llmAttrSpan = tracer.startSpan('llm_attr_operation', {}, parentContext);
    llmAttrSpan.setAttributes({ 'llm.tokens': 100 });

    const aiAttrSpan = tracer.startSpan('ai_attr_operation', {}, parentContext);
    aiAttrSpan.setAttributes({ ai_temperature: 0.7 });

    const regularSpan = tracer.startSpan('regular_operation', {}, parentContext);
    regularSpan.setAttributes({ 'database.connection': 'postgres' });

    genAiAttrSpan.end();
    braintrustAttrSpan.end();
    llmAttrSpan.end();
    aiAttrSpan.end();
    regularSpan.end();
    rootSpan.end();

    const spans = memoryExporter.getFinishedSpans();
    const spanNames = spans.map((s) => s.name);

    expect(spanNames).toContain('root');
    expect(spanNames).toContain('gen_ai_attr_operation');
    expect(spanNames).toContain('braintrust_attr_operation');
    expect(spanNames).toContain('llm_attr_operation');
    expect(spanNames).toContain('ai_attr_operation');
    expect(spanNames).not.toContain('regular_operation');
  });

  it('should support custom filter that keeps spans', () => {
    const customFilter = (span: any) => {
      if (span.name === 'custom_keep') {
        return true;
      }
      return null; // Don't influence decision
    };

    // Create new processor with custom filter
    const customMemoryExporter = new InMemorySpanExporter();
    const customLLMProcessor = new LLMSpanProcessor(
      new SimpleSpanProcessor(customMemoryExporter),
      customFilter
    );
    const customProvider = new BasicTracerProvider();
    customProvider.addSpanProcessor(customLLMProcessor);
    const customTracer = customProvider.getTracer('custom_test');

    const rootSpan = customTracer.startSpan('root');

    const parentContext = trace.setSpanContext(context.active(), rootSpan.spanContext());
    const keepSpan = customTracer.startSpan('custom_keep', {}, parentContext);
    const regularSpan = customTracer.startSpan('regular_operation', {}, parentContext);

    keepSpan.end();
    regularSpan.end();
    rootSpan.end();

    const spans = customMemoryExporter.getFinishedSpans();
    const spanNames = spans.map((s) => s.name);

    expect(spanNames).toContain('root');
    expect(spanNames).toContain('custom_keep'); // kept by custom filter
    expect(spanNames).not.toContain('regular_operation'); // dropped by default logic

    customProvider.shutdown();
  });

  it('should support custom filter that drops spans', () => {
    const customFilter = (span: any) => {
      if (span.name === 'gen_ai.drop_this') {
        return false;
      }
      return null; // Don't influence decision
    };

    // Create new processor with custom filter
    const customMemoryExporter = new InMemorySpanExporter();
    const customLLMProcessor = new LLMSpanProcessor(
      new SimpleSpanProcessor(customMemoryExporter),
      customFilter
    );
    const customProvider = new BasicTracerProvider();
    customProvider.addSpanProcessor(customLLMProcessor);
    const customTracer = customProvider.getTracer('custom_test');

    const rootSpan = customTracer.startSpan('root');

    const parentContext = trace.setSpanContext(context.active(), rootSpan.spanContext());
    const dropSpan = customTracer.startSpan('gen_ai.drop_this', {}, parentContext);
    const keepSpan = customTracer.startSpan('gen_ai.keep_this', {}, parentContext);

    dropSpan.end();
    keepSpan.end();
    rootSpan.end();

    const spans = customMemoryExporter.getFinishedSpans();
    const spanNames = spans.map((s) => s.name);

    expect(spanNames).toContain('root');
    expect(spanNames).not.toContain('gen_ai.drop_this'); // dropped by custom filter
    expect(spanNames).toContain('gen_ai.keep_this'); // kept by default LLM logic

    customProvider.shutdown();
  });

  it('should support custom filter that defers to default logic', () => {
    const customFilter = (span: any) => {
      return null; // Always defer to default logic
    };

    // Create new processor with custom filter
    const customMemoryExporter = new InMemorySpanExporter();
    const customLLMProcessor = new LLMSpanProcessor(
      new SimpleSpanProcessor(customMemoryExporter),
      customFilter
    );
    const customProvider = new BasicTracerProvider();
    customProvider.addSpanProcessor(customLLMProcessor);
    const customTracer = customProvider.getTracer('custom_test');

    const rootSpan = customTracer.startSpan('root');

    const parentContext = trace.setSpanContext(context.active(), rootSpan.spanContext());
    const llmSpan = customTracer.startSpan('gen_ai.completion', {}, parentContext);
    const regularSpan = customTracer.startSpan('regular_operation', {}, parentContext);

    llmSpan.end();
    regularSpan.end();
    rootSpan.end();

    const spans = customMemoryExporter.getFinishedSpans();
    const spanNames = spans.map((s) => s.name);

    expect(spanNames).toContain('root');
    expect(spanNames).toContain('gen_ai.completion'); // kept by default LLM logic
    expect(spanNames).not.toContain('regular_operation'); // dropped by default logic

    customProvider.shutdown();
  });
});
