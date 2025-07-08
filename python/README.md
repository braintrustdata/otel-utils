# Braintrust Python OTel Utils

## Installation

```bash
pip install braintrust-otel-utils
```

## Filtering LLM Spans

If you'd like to send only LLM spans to Braintrust, add our `LLMSpanProcessor` to your OTel pipeline. If you want to fine-tune the data you 
send to Braintrust, copy the [span_processor.py](span_processor.py) file to your repo and customize as needed.

```python
import os
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

from span_processor import LLMSpanProcessor

# Set up your exporter and batch processor
exporter = OTLPSpanExporter(
    endpoint="https://api.braintrust.dev/otel/v1/traces",
    headers={
        "Authorization": f"Bearer {os.getenv('BRAINTRUST_API_KEY')}",
        "x-bt-parent": f"project_id:{os.getenv('BRAINTRUST_PROJECT_ID')}",
    }
)
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

### Custom Filtering

You can provide a custom filter function for additional control:

```python
def my_custom_filter(span):
    # Keep spans from specific services
    if span.name.startswith("my_service."):
        return True
    # Drop noisy spans even if they match LLM patterns
    if span.name == "gen_ai.debug":
        return False
    # Let default logic decide for everything else
    return None

llm_processor = LLMSpanProcessor(batch_processor, custom_filter=my_custom_filter)
```

## What Gets Filtered

**Kept:**
- Root spans (preserves trace structure)
- Spans kept by custom filter (if provided)
- Spans with names starting with: `gen_ai.`, `braintrust.`, `llm.`, `ai.`
- Spans with attribute names starting with those prefixes

**Dropped:**
- Spans dropped by custom filter (if provided)
- Database queries, HTTP requests, cache operations, etc.

**Filter Priority:**
1. Root spans are always kept
2. Custom filter decides (if provided): `True` = keep, `False` = drop, `None` = use default logic
3. Default LLM filtering logic applies

This dramatically reduces telemetry volume while preserving all LLM-related observability.