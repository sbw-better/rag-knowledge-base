package com.example.rag.model;

import java.util.List;

public interface EmbeddingClient {
    List<Double> embed(String text);
}
