#include <stddef.h>
#include <math.h>
#include <cstdint>
#include <iostream>
#include <algorithm>

#include "Point2D.h"

extern size_t ZSTD_decompress(void* dst, size_t dstCapacity, const void* src, size_t srcSize);


union Block {
    int intValues[4];
    char byteValues[16];
};

const float MiterLimit = 1.5f;
const int VertexDataElements = 8;

extern "C" {

void decodeArray(char* dst, size_t dstCapacity, int decimationFactor) {
    int numIntegers = dstCapacity / 4;
    int* intArray = (int*) dst;
    float* floatArray = (float*) dst;

    float scale = 1.0 / decimationFactor;

    int blockedLength = 4 * (numIntegers / 4);
    int v = 0;

    Block block;
    
    // Un-shuffle data and convert from int to float based on decimation factor
    for (v = 0; v < blockedLength; v += 4) {
        const int i = 4 * v;
        block.byteValues[0] = dst[i];
        block.byteValues[1] = dst[i + 4];
        block.byteValues[2] = dst[i + 8];
        block.byteValues[3] = dst[i + 12];
        block.byteValues[4] = dst[i + 1];
        block.byteValues[5] = dst[i + 5];
        block.byteValues[6] = dst[i + 9];
        block.byteValues[7] = dst[i + 13];
        block.byteValues[8] = dst[i + 2];
        block.byteValues[9] = dst[i + 6];
        block.byteValues[10] = dst[i + 10];
        block.byteValues[11] = dst[i + 14];
        block.byteValues[12] = dst[i + 3];
        block.byteValues[13] = dst[i + 7];
        block.byteValues[14] = dst[i + 11];
        block.byteValues[15] = dst[i + 15];

        floatArray[v] = block.intValues[0] * scale;
        floatArray[v + 1] = block.intValues[1] * scale;
        floatArray[v + 2] = block.intValues[2] * scale;
        floatArray[v + 3] = block.intValues[3] * scale;
    }

    for (; v < numIntegers; v++) {
        floatArray[v] = intArray[v] * scale;
    }

    float lastX = 0;
    float lastY = 0;

    for (int i = 0; i < numIntegers - 1; i += 2) {
        float deltaX = floatArray[i];
        float deltaY = floatArray[i + 1];
        lastX += deltaX;
        lastY += deltaY;
        floatArray[i] = lastX;
        floatArray[i + 1] = lastY;
    }
}

// Used for connecting the line strip between polylines with degenerate triangles
void fillDegenerateData(float* vertexData, int16_t* vertexDataShort, int offset, const Point2D& vertex, const Point2D& normal, float length) {
    vertexData[offset] = vertex.x;
    vertexData[offset + 1] = vertex.y;
    vertexData[offset + 2] = length;
    vertexDataShort[(offset + 3) * 2] = 16384 * normal.x;
    vertexDataShort[(offset + 3) * 2 + 1] = 16384 * normal.y;
}

void fillVertexData(float* vertexData, int16_t* vertexDataShort, int offset, const Point2D& vertex, const Point2D& normal, float length) {
    vertexData[offset] = vertex.x;
    vertexData[offset + 1] = vertex.y;
    vertexData[offset + 2] = length;
    vertexDataShort[(offset + 3) * 2] = 16384 * normal.x;
    vertexDataShort[(offset + 3) * 2 + 1] = 16384 * normal.y;

    vertexData[offset + 4] = vertex.x;
    vertexData[offset + 5] = vertex.y;
    vertexData[offset + 6] = -length;
    vertexDataShort[(offset + 7) * 2] = -16384 * normal.x;
    vertexDataShort[(offset + 7) * 2 + 1] = -16384 * normal.y;
}

void fillSinglePolyline(float* sourceVertices, int startIndex, int endIndex, int& dstIndex, float* vertexData, int16_t* vertexDataShort, bool duplicateFirst, bool duplicateLast) {
    int numVertices = endIndex - startIndex;
    if (numVertices < 2) {
        return;
    }

    // First vertex
    int vertexOffset = startIndex * 2;
    Point2D currentPoint = {sourceVertices[vertexOffset], sourceVertices[vertexOffset + 1]};
    Point2D nextPoint = {sourceVertices[vertexOffset + 2], sourceVertices[vertexOffset + 3]};

    float segmentLength = length2D(subtract2D(currentPoint, nextPoint));
    float cumulativeLength = segmentLength;

    Point2D firstDir = normalize2D(subtract2D(nextPoint, currentPoint));

    if (!isfinite(firstDir.x) || !isfinite(firstDir.y)) {
        // Find first non-degenerate vertex and use that as the initial direction
        for (int i = 2; i < numVertices - 1; i++) {
            int newOffset = (startIndex + i) * 2;
            nextPoint = {sourceVertices[newOffset], sourceVertices[newOffset + 1]};
            firstDir = normalize2D(subtract2D(nextPoint, currentPoint));
            if (isfinite(firstDir.x) && isfinite(firstDir.y)) {
                break;
            }
        }
    }

    Point2D prevDir = firstDir;
    Point2D prevNormal;

    int initialDstIndex = dstIndex;
    dstIndex += VertexDataElements;

    // Move pointer forward by half the size of a generated vertex. This will be written at the end of the loop
    if (duplicateFirst) {
        dstIndex += VertexDataElements / 2;
    }

    // Inner vertices
    for (int i = 1; i < numVertices - 1; i++) {
        int index = i + startIndex;
        vertexOffset = index * 2;
        int normalOffset = index * VertexDataElements;

        currentPoint = {sourceVertices[vertexOffset], sourceVertices[vertexOffset + 1]};
        nextPoint = {sourceVertices[vertexOffset + 2], sourceVertices[vertexOffset + 3]};

        Point2D currentDir = normalize2D(subtract2D(nextPoint, currentPoint));
        // Handle degenerate vertices
        if (!isfinite(currentDir.x) || !isfinite(currentDir.y)) {
            currentDir = prevDir;
        }

        Point2D currentNormal = perpVector2D(currentDir);
        Point2D tangent = normalize2D(add2D(prevDir, currentDir));
        Point2D tangentNormal = perpVector2D(tangent);
        float miterLength = std::min(1.0f / dot2D(tangent, prevDir), MiterLimit);
        // Prevent mitre issues when going backwards
        if (isnan(miterLength)) {
            miterLength = 1.0;
        }
        Point2D computedNormal = scale2D(tangentNormal, miterLength);

        fillVertexData(vertexData, vertexDataShort, dstIndex, currentPoint, computedNormal, cumulativeLength);

        prevNormal = currentNormal;
        prevDir = currentDir;
        segmentLength = length2D(subtract2D(currentPoint, nextPoint));
        cumulativeLength += segmentLength;
        dstIndex += VertexDataElements;
    }

    Point2D firstNorm, lastNorm;

    // Test if the line is a closed loop
    Point2D firstPoint = {sourceVertices[startIndex * 2], sourceVertices[startIndex * 2 + 1]};
    Point2D lastPoint = {sourceVertices[(endIndex - 1) * 2], sourceVertices[(endIndex - 1) * 2 + 1]};
    float firstLastDist = length2D(subtract2D(firstPoint, lastPoint));
    bool loop = firstLastDist < 1e-6;

    if (loop) {
        // Join first and last lines
        Point2D tangent = normalize2D(add2D(prevDir, firstDir));
        Point2D tangentNormal = perpVector2D(tangent);
        float mitreLength = std::min(1.0f / dot2D(tangent, prevDir), MiterLimit);
        firstNorm = scale2D(tangentNormal, mitreLength);
        lastNorm = firstNorm;
    } else {
        firstNorm = perpVector2D(firstDir);
        lastNorm = prevNormal;
    }

    // Fill in first and last normals
    if (duplicateFirst) {
        // Also write a degenerate vertex to join line strip
        fillDegenerateData(vertexData, vertexDataShort, initialDstIndex, firstPoint, firstNorm, 0);
        fillVertexData(vertexData, vertexDataShort, initialDstIndex + VertexDataElements / 2, firstPoint, firstNorm, 0);
    } else {
        fillVertexData(vertexData, vertexDataShort, initialDstIndex, firstPoint, firstNorm, 0);
    }

    fillVertexData(vertexData, vertexDataShort, dstIndex, lastPoint, lastNorm, cumulativeLength);
    dstIndex += VertexDataElements;

    if (duplicateLast) {
        // Also write a degenerate vertex to join line strip. Reverse the normal,
        // as the vertex needs to be degenerate with the second generated vertex
        fillDegenerateData(vertexData, vertexDataShort, dstIndex, lastPoint, scale2D(lastNorm, -1), cumulativeLength);
        dstIndex += VertexDataElements / 2;
    }
}

void generateVertexData(void* dst, size_t dstCapacity, float* srcVertices, int numVertices, int* indexOffsets, int numPolyLines) {
    int16_t* vertexDataShort = (int16_t*) dst;
    float* vertexData = (float*) dst;

    int dstIndex = 0;
    for (int i = 0; i < numPolyLines; i++) {
        int startIndex = indexOffsets[i] / 2;
        int endIndex = i < numPolyLines - 1 ? indexOffsets[i + 1] / 2 : numVertices;
        fillSinglePolyline(srcVertices, startIndex, endIndex, dstIndex, vertexData, vertexDataShort, i > 0, i < numPolyLines - 1);
    }
}

}