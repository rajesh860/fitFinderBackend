import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

export const deleteFileFromS3 = async (filePath) => {
  try {
    if (!filePath) return;

    let key = decodeURIComponent(filePath);

    // ❌ DO NOT REMOVE "uploads/" prefix
    // if (key.startsWith("uploads/")) key = key.replace("uploads/", "");

    // ✅ Handle full URL
    if (key.startsWith("http")) {
      const baseUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/`;
      key = key.replace(baseUrl, "");
    }

    await s3.send(
      new DeleteObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
      })
    );

    console.log("✅ Deleted from S3:", key);
  } catch (err) {
    console.error("❌ S3 delete failed:", err.message);
  }
};

