# Braintrust TypeScript OTel Utils

## Installation

```bash
npm install @braintrust/otel-utils
```

## Filtering LLM Spans

If you'd like to send only LLM spans to Braintrust, add our `LLMSpanProcessor` to your OTel pipeline. If you want to fine-tune the data you send to Braintrust, copy the [llm-span-processor.ts](src/llm-span-processor.ts) file to your repo and customize as needed.

```typescript
import { TracerProvider } from '@opentelemetry/sdk-trace-base';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-http';
import { LLMSpanProcessor } from '@braintrust/otel-utils';

// Set up your exporter and batch processor
const exporter = new OTLPTraceExporter({
  endpoint: 'https://api.braintrust.dev/otel/v1/traces',
});
const batchProcessor = new BatchSpanProcessor(exporter);

// Wrap with LLM filtering
const llmProcessor = new LLMSpanProcessor(batchProcessor);

// Configure tracing
const provider = new TracerProvider();
provider.addSpanProcessor(llmProcessor);
```

### Custom Filtering

You can provide a custom filter function for additional control:

```typescript
import { LLMSpanProcessor, CustomSpanFilter } from '@braintrust/otel-utils';

const myCustomFilter: CustomSpanFilter = (span) => {
  // Keep spans from specific services
  if (span.name.startsWith('my_service.')) {
    return true;
  }
  // Drop noisy spans even if they match LLM patterns
  if (span.name === 'gen_ai.debug') {
    return false;
  }
  // Let default logic decide for everything else
  return null;
};

const llmProcessor = new LLMSpanProcessor(batchProcessor, myCustomFilter);
```

## What Gets Filtered

**Kept:**
- Root spans (preserves trace structure)
- Spans with names starting with: `gen_ai.`, `braintrust.`, `llm.`, `ai.`
- Spans with attribute names starting with those prefixes

**Dropped:**
- Database queries, HTTP requests, cache operations, etc.

This dramatically reduces telemetry volume while preserving all LLM-related observability.