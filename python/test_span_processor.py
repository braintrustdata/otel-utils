from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

from span_processor import LLMSpanProcessor


class TestLLMSpanFiltering:
    """Test the LLM-aware span filtering logic using real OpenTelemetry components."""

    def setup_method(self):
        """Set up a fresh tracer for each test."""
        self.memory_exporter = InMemorySpanExporter()
        self.provider = TracerProvider()

        # Create processor with our filtering logic
        base_processor = SimpleSpanProcessor(self.memory_exporter)
        self.filtering_processor = LLMSpanProcessor(base_processor)

        self.provider.add_span_processor(self.filtering_processor)
        self.tracer = self.provider.get_tracer("test_tracer")

    def teardown_method(self):
        """Clean up after each test."""
        self.provider.shutdown()
        self.memory_exporter.clear()

    def test_keeps_root_spans(self):
        """Root spans should always be kept."""
        with self.tracer.start_as_current_span("root_operation"):
            pass

        spans = self.memory_exporter.get_finished_spans()
        assert len(spans) == 1
        assert spans[0].name == "root_operation"

    def test_keeps_gen_ai_spans(self):
        """Spans starting with 'gen_ai.' should be kept."""
        with self.tracer.start_as_current_span("root"):
            with self.tracer.start_as_current_span("gen_ai.completion"):
                pass
            with self.tracer.start_as_current_span("regular_operation"):
                pass

        spans = self.memory_exporter.get_finished_spans()
        span_names = [span.name for span in spans]

        assert "root" in span_names
        assert "gen_ai.completion" in span_names
        assert "regular_operation" not in span_names

    def test_keeps_braintrust_spans(self):
        """Spans starting with 'braintrust.' should be kept."""
        with self.tracer.start_as_current_span("root"):
            with self.tracer.start_as_current_span("braintrust.eval"):
                pass
            with self.tracer.start_as_current_span("database_query"):
                pass

        spans = self.memory_exporter.get_finished_spans()
        span_names = [span.name for span in spans]

        assert "braintrust.eval" in span_names
        assert "database_query" not in span_names

    def test_keeps_llm_spans(self):
        """Spans starting with 'llm.' should be kept."""
        with self.tracer.start_as_current_span("root"):
            with self.tracer.start_as_current_span("llm.generate"):
                pass

        spans = self.memory_exporter.get_finished_spans()
        span_names = [span.name for span in spans]
        assert "llm.generate" in span_names

    def test_keeps_ai_spans(self):
        """Spans starting with 'ai' should be kept."""
        with self.tracer.start_as_current_span("root"):
            with self.tracer.start_as_current_span("ai_model_call"):
                pass

        spans = self.memory_exporter.get_finished_spans()
        span_names = [span.name for span in spans]
        assert "ai_model_call" in span_names

    def test_keeps_spans_with_llm_attributes(self):
        """Spans with LLM-related attribute names should be kept."""
        with self.tracer.start_as_current_span("root"):
            with self.tracer.start_as_current_span("some_operation") as span:
                span.set_attribute("gen_ai.model", "gpt-4")
                span.set_attribute("regular_data", "value")
            with self.tracer.start_as_current_span("another_operation") as span:
                span.set_attribute("llm.tokens", 100)
            with self.tracer.start_as_current_span("third_operation") as span:
                span.set_attribute("database.connection", "postgres")

        spans = self.memory_exporter.get_finished_spans()
        span_names = [span.name for span in spans]

        assert "root" in span_names
        assert "some_operation" in span_names  # has gen_ai.model attribute
        assert "another_operation" in span_names  # has llm.tokens attribute
        assert "third_operation" not in span_names  # no LLM attributes

    def test_drops_non_llm_spans(self):
        """Non-LLM spans should be filtered out."""
        with self.tracer.start_as_current_span("root"):
            with self.tracer.start_as_current_span("database_query"):
                pass
            with self.tracer.start_as_current_span("http_request"):
                pass
            with self.tracer.start_as_current_span("file_operation"):
                pass

        spans = self.memory_exporter.get_finished_spans()

        # Only root should be kept
        assert len(spans) == 1
        assert spans[0].name == "root"

    def test_filtering_vs_unfiltered_comparison(self):
        """Compare filtered vs unfiltered exporters to verify filtering works."""
        # Set up two separate exporters and processors
        all_spans_exporter = InMemorySpanExporter()
        filtered_spans_exporter = InMemorySpanExporter()

        # Processor that captures everything
        all_processor = SimpleSpanProcessor(all_spans_exporter)

        # Processor that filters LLM spans
        filtered_processor = LLMSpanProcessor(
            SimpleSpanProcessor(filtered_spans_exporter)
        )

        # Set up provider with both processors
        provider = TracerProvider()
        provider.add_span_processor(all_processor)
        provider.add_span_processor(filtered_processor)
        tracer = provider.get_tracer("comparison_test")

        # Create a mix of spans - some LLM-related, some not
        with tracer.start_as_current_span("user_request") as root:
            root.set_attribute("request.id", "123")

            with tracer.start_as_current_span("database_query"):
                pass

            with tracer.start_as_current_span("gen_ai.completion") as llm_span:
                llm_span.set_attribute("gen_ai.model", "gpt-4")

            with tracer.start_as_current_span("cache_lookup"):
                pass

            with tracer.start_as_current_span("response_formatting") as resp_span:
                resp_span.set_attribute("llm.tokens", 150)

            with tracer.start_as_current_span("http_response"):
                pass

        # Clean up
        provider.shutdown()

        # Verify all spans were captured by the unfiltered exporter
        all_spans = all_spans_exporter.get_finished_spans()
        all_span_names = [span.name for span in all_spans]

        assert len(all_spans) == 6
        assert "user_request" in all_span_names
        assert "database_query" in all_span_names
        assert "gen_ai.completion" in all_span_names
        assert "cache_lookup" in all_span_names
        assert "response_formatting" in all_span_names
        assert "http_response" in all_span_names

        # Verify only LLM spans were captured by the filtered exporter
        filtered_spans = filtered_spans_exporter.get_finished_spans()
        filtered_span_names = [span.name for span in filtered_spans]

        assert len(filtered_spans) == 3
        assert "user_request" in filtered_span_names  # root span
        assert "gen_ai.completion" in filtered_span_names  # LLM name
        assert "response_formatting" in filtered_span_names  # LLM attribute
