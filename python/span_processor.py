from opentelemetry.sdk.trace import Span
from opentelemetry.sdk.trace.export import SpanProcessor

LLM_PREFIXES = ("gen_ai.", "braintrust.", "llm.", "ai")


class FilteringSpanProcessor(SpanProcessor):
    """
    A span processor that filters spans based on a provided filter function.

    Only spans that pass the filter function will be forwarded to the inner processor.
    This allows selective export of spans based on custom criteria.
    """

    def __init__(self, inner_processor: SpanProcessor, filter_fn):
        """
        Initialize the filtering span processor.

        Args:
            inner_processor: The wrapped span processor that will receive filtered spans
            filter_fn: A function that takes a Span and returns True if it should be
                kept
        """
        self._inner = inner_processor
        self._filter_fn = filter_fn

    def on_start(self, span: Span, parent_context=None) -> None:
        """Forward span start events to the inner processor."""
        self._inner.on_start(span, parent_context)

    def on_end(self, span: Span) -> None:
        """Apply filtering logic and conditionally forward span end events."""
        if self._filter_fn(span):
            self._inner.on_end(span)

    def shutdown(self) -> None:
        """Shutdown the inner processor."""
        self._inner.shutdown()

    def force_flush(self, timeout_millis: int = 30000) -> bool:
        """Force flush the inner processor."""
        return self._inner.force_flush(timeout_millis)

    @staticmethod
    def should_keep_llm_span(span: Span) -> bool:
        """
        Keep spans if:
        1. It's a root span (no parent)
        2. Span name starts with 'gen_ai.', 'braintrust.', 'llm.', or 'ai'
        3. Any attribute name starts with those prefixes
        """
        if span.parent is None:
            return True

        # Check span name
        if span.name.startswith(LLM_PREFIXES):
            return True

        # Check attribute names
        if span.attributes:
            for attr_name in span.attributes.keys():
                if attr_name.startswith(LLM_PREFIXES):
                    return True

        return False
