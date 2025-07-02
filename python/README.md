# Braintrust Python OTel Utils

## Installation

```bash
pip install braintrust-otel-utils
```

## Filtering LLM Spans

If you'd like to send only LLM spans to Braintrust, add our `LLMSpanProcessor` to your OTel pipeline. If you want to fine-tune the data you 
send to Braintrust, copy the [span_processor.py](span_processor.py) file to your repo and customize as needed.

```python
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

from span_processor import LLMSpanProcessor

# Set up your exporter and batch processor
exporter = OTLPSpanExporter(endpoint="https://api.braintrust.dev/otel/v1/traces")
batch_processor = BatchSpanProcessor(exporter)

# Wrap with LLM filtering
llm_processor = LLMSpanProcessor(batch_processor)

# Configure tracing
provider = TracerProvider()
provider.add_span_processor(llm_processor)
trace.set_tracer_provider(provider)

# Use as normal - only LLM spans will be exported
tracer = trace.get_tracer("my_app")
```

## What Gets Filtered

**Kept:**
- Root spans (preserves trace structure)
- Spans with names starting with: `gen_ai.`, `braintrust.`, `llm.`, `ai`
- Spans with attribute names starting with those prefixes

**Dropped:**
- Database queries, HTTP requests, cache operations, etc.

This dramatically reduces telemetry volume while preserving all LLM-related observability.