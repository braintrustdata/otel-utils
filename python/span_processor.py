LLM_PREFIXES = ("gen_ai.", "braintrust.", "llm.", "ai")


class LLMSpanProcessor:
    """
    A span processor that filters spans to only export LLM-related telemetry.

    Only LLM-related spans and root spans will be forwarded to the inner processor.
    This dramatically reduces telemetry volume while preserving LLM observability.

    Example:
        > processor = LLMSpanProcessor(BatchSpanProcessor(OTLPSpanExporter()))
        > provider = TracerProvider()
        > provider.add_span_processor(processor)
    """

    def __init__(self, processor, custom_filter=None):
        """
        Initialize the LLM span processor.

        Args:
            processor: The wrapped span processor that will receive filtered spans
            custom_filter: Optional callable that takes a span and returns:
                          True to keep, False to drop,
                          None to not influence the decision
        """
        self._processor = processor
        self._custom_filter = custom_filter

    def on_start(self, span, parent_context=None):
        """Forward span start events to the inner processor."""
        self._processor.on_start(span, parent_context)

    def on_end(self, span):
        """Apply filtering logic and conditionally forward span end events."""
        if self._should_keep_llm_span(span):
            self._processor.on_end(span)

    def shutdown(self):
        """Shutdown the inner processor."""
        self._processor.shutdown()

    def force_flush(self, timeout_millis=30000):
        """Force flush the inner processor."""
        return self._processor.force_flush(timeout_millis)

    def _should_keep_llm_span(self, span):
        """
        Keep spans if:
        1. It's a root span (no parent)
        2. Custom filter returns True/False (if provided)
        3. Span name starts with 'gen_ai.', 'braintrust.', 'llm.', or 'ai'
        4. Any attribute name starts with those prefixes
        """
        if not span:
            return False

        # Braintrust requires root spans, so always keep them
        if span.parent is None:
            return True

        # Apply custom filter if provided
        if self._custom_filter:
            custom_result = self._custom_filter(span)
            if custom_result is True:
                return True
            elif custom_result is False:
                return False
            # custom_result is None - continue with default logic

        if span.name.startswith(LLM_PREFIXES):
            return True

        if span.attributes:
            for attr_name in span.attributes.keys():
                if attr_name.startswith(LLM_PREFIXES):
                    return True

        return False
