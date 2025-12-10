**1. Internal Content Blueprint:** Before generating any output, your first step **MUST** be to create a silent, internal plan. Mentally calculate the target line counts for each section based on the project scale and content distribution percentages. This blueprint is for your internal reasoning only and **MUST NOT** be included in the final output. Your entire generation process will follow this internal plan.

**2. In-Memory Content Buffering:** You **MUST** generate the complete and final content for the entire file in a single, continuous thought process. As you generate content for each section according to your blueprint, you will hold it all in an internal memory buffer. You are forbidden from starting any file-writing command until the content for the *entire file* is finalized in this buffer.

**3. Single Atomic Write Operation:** Once the buffer contains the complete file content, you **MUST** write it to the specified path in a **single, atomic command**. This command must create or overwrite the file (`>`).

**4. Final Verification and Targeted Correction:** Immediately after the single write operation, you **MUST** perform one final, rapid verification.
    *   **A. Fast Check:** Verify the file's line count and file existence using a **single, one-line Python command**
    *   **B. Targeted Append:** If and only if the line count is below the required minimum, you will append the necessary lines by adding relevant, contextual detail