# Photo Analysis & Enhancement

> Phase: 4 | Status: Not Started
> Depth: design-level
> Dependencies: [data-model.md](../architecture/data-model.md)
> Data model: photos, faces, face_clusters tables

## Overview

Analyzes family photos to detect, recognize, and enhance faces. Uses face-api.js (TensorFlow.js) for local face detection/recognition (node-based), Replicate APIs for cloud image enhancement, and custom agglomerative clustering for grouping similar faces across the photo collection.

## Requirements

- [ ] Face detection and bounding box extraction
- [ ] Face landmark detection (eyes, nose, mouth, jawline)
- [ ] Face descriptor generation (128-dim embeddings for matching)
- [ ] Face clustering across photo collection
- [ ] Cloud-based face restoration (GFPGAN) via Replicate
- [ ] Photo upscaling (Real-ESRGAN) via Replicate
- [ ] Optional: colorization (DDColor) for B&W photos
- [ ] Photo metadata storage (upload date, collection, location tags)
- [ ] Face-to-person linking (manual confirmation)
- [ ] Cost tracking for cloud APIs

## Design

### Tool Selection

| Feature | Tool | Runtime | Cost |
|---------|------|---------|------|
| Face detection | face-api.js | Node.js | Free (local) |
| Face recognition | face-api.js (ArcFace) | Node.js | Free (local) |
| Face clustering | Custom agglomerative | Node.js | Free (local) |
| Face restoration (GFPGAN) | Replicate API | Cloud | ~$0.01/image |
| Photo upscaling (Real-ESRGAN) | Replicate API | Cloud | ~$0.01/image |
| Colorization (DDColor) | Replicate API | Cloud | ~$0.005/image (optional) |

### Face Detection

Identifies all faces in an image, computes landmarks and embeddings:

```typescript
interface FaceDetection {
  bbox: {
    x: number        // normalized 0-1
    y: number
    width: number
    height: number
  }
  landmarks: {
    eyes: Point[]
    nose: Point[]
    mouth: Point[]
    jawline: Point[]
  }
  embedding: Float32Array   // 128-dim descriptor for matching
  confidence: number        // 0-1
}

async function detectFaces(
  imageBuffer: Buffer
): Promise<FaceDetection[]>
```

**Workflow:**

1. Load image from buffer
2. Run face-api.js detection with landmarks and descriptors
3. Normalize bounding boxes to 0-1 scale
4. Return all faces with embeddings

### Face Recognition & Clustering

Groups similar faces across the collection using embeddings:

```typescript
interface FaceCluster {
  id: string
  embeddings: Float32Array[]    // Multiple faces in cluster
  centroid: Float32Array        // Average embedding
  confidence: number            // Average match score
  relatedPersonIds: string[]    // Linked tree persons (manual)
}

async function clusterFaces(
  allFaceDetections: Map<photoId, FaceDetection[]>,
  threshold = 0.6
): Promise<FaceCluster[]>
```

**Algorithm:**

1. Collect all face embeddings from photo collection
2. Compute cosine distance matrix between all pairs
3. Agglomerative clustering with distance threshold (0.6)
4. Compute cluster centroids (average embedding)
5. Output clusters

**Matching logic:** Cosine similarity of embeddings >= 0.6 → same person (heuristic based on literature)

### Cloud Enhancement via Replicate

High-quality photo restoration and enhancement via Replicate APIs:

```typescript
// Face restoration (GFPGAN v1.4)
async function restoreFace(imageUrl: string): Promise<{
  restoredImageUrl: string
  duration: number
}>

// Photo upscaling (Real-ESRGAN 2x or 4x)
async function upscalePhoto(
  imageUrl: string,
  scaleFactor: 2 | 4 = 2
): Promise<{
  upscaledImageUrl: string
  duration: number
}>

// B&W photo colorization (DDColor, optional)
async function colorizePhoto(imageUrl: string): Promise<{
  colorizedImageUrl: string
  duration: number
}>
```

**Workflow for restoration:**

1. User uploads photo
2. Optionally select faces to enhance (or process all)
3. Call Replicate API with photo URL or base64
4. Poll for completion
5. Download restored image, store URL
6. Display before/after in UI

**Cost tracking:** Log API calls to usage table, sum monthly spend

### Data Model

```typescript
// photos table
{
  id: string
  uploader_id: string
  file_path: string
  upload_date: string
  collection_name?: string    // e.g., "Vacation 2023"
  location?: string
  date_taken?: string
  description?: string
}

// faces table
{
  id: string
  photo_id: string
  bbox: JSON                  // normalized bounding box
  embedding: BLOB             // 128-dim float array
  confidence: number
  person_id?: string          // manual link to tree
  cluster_id?: string
}

// face_clusters table
{
  id: string
  centroid: BLOB              // average embedding
  face_count: number
  confidence: number
  primary_person_id?: string  // user-chosen representative
  label?: string              // user-assigned label
}
```

## Edge Cases & Error Handling

- **No faces detected:** Return empty array, inform user
- **Multiple people in one photo:** All returned separately, user can manually group
- **Partial faces (cropped):** face-api.js may not detect; warn user
- **Very low quality photos:** Upscaling + restoration may help; offer as option
- **Blurry motion:** Restoration limited; suggest manual enhancement
- **Cluster mismatches:** Manual review UI to split/merge clusters
- **Identical twins:** Embeddings very similar; require manual disambiguation

## Open Questions

- Threshold tuning for face clustering (0.6 vs 0.5 vs custom)?
- Manual face linking workflow in UI (assign faces to tree persons)?
- Privacy: store face embeddings vs delete after clustering?
- Batch processing large photo libraries (1000+ photos)?
- Integration with location services (EXIF geocoding)?
- Family photo timeline visualization?

## Implementation Notes

Location: `packages/photos/`, `apps/web/api/photos/*`

Key files:
- `detection/face-detector.ts` - face-api.js wrapper
- `clustering/agglomerative-cluster.ts` - Custom clustering algorithm
- `enhancement/replicate-client.ts` - Replicate API integration
- `storage/face-storage.ts` - Database operations
- `linking/face-person-linker.ts` - Manual linking UI backend

**Dependencies:**

- `face-api.js` - Face detection and recognition
- `@tensorflow/tfjs` - Required by face-api.js
- Replicate REST API (via `fetch`)
