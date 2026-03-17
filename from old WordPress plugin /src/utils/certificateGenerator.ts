import { jsPDF } from "jspdf";

const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = url;
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(e);
    });
};

export const generateCertificate = async (
    userName: string, 
    courseName: string, 
    completedDate: string, 
    siteName: string,
    logoUrl?: string
) => {
    // Validate inputs - jsPDF.text() requires non-null strings
    const safeUserName = userName || "Student";
    const safeCourseName = courseName || "Course";
    const safeCompletedDate = completedDate || new Date().toLocaleDateString();
    const safeSiteName = siteName || "AquaticPro";
    
    // Landscape orientation for a classic certificate look
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();

    // -- Aquatic Design Elements --
    
    // Background: Very light aquatic blue
    doc.setFillColor(245, 250, 255); // #F5FAFF
    doc.rect(0, 0, width, height, "F");
    
    // Watermark / Wave effect (Circles in bottom corners)
    doc.setFillColor(224, 242, 254); // Light Sky Blue
    doc.circle(0, height, 80, "F");
    doc.circle(width, height, 60, "F");
    doc.setFillColor(186, 230, 253); // Slightly darker
    doc.circle(0, height, 60, "F");
    doc.circle(width, height, 40, "F");

    // Outer Border
    doc.setDrawColor(2, 62, 138); // Deep Ocean Blue (#023E8A)
    doc.setLineWidth(3);
    doc.rect(10, 10, width - 20, height - 20);
    
    // Inner Border
    doc.setDrawColor(0, 119, 182); // Ocean Blue (#0077B6)
    doc.setLineWidth(1);
    doc.rect(14, 14, width - 28, height - 28);
    
    // Corner flourishes - Waves
    doc.setDrawColor(0, 150, 199); // Pacific Blue (#0096C7)
    doc.setLineWidth(0.5);
    // Top Left Wave
    doc.line(14, 25, 25, 25);
    doc.line(25, 25, 25, 14);
    // Top Right Wave
    doc.line(width - 14, 25, width - 25, 25);
    doc.line(width - 25, 25, width - 25, 14);

    // -- Logo --
    if (logoUrl) {
        try {
            const img = await loadImage(logoUrl);
            const imgWidth = 30; // mm
            const ratio = img.width / img.height;
            const imgHeight = imgWidth / ratio;
            // Place logo at top center
            doc.addImage(img, "PNG", (width / 2) - (imgWidth / 2), 20, imgWidth, imgHeight);
        } catch (e) {
            console.warn("Certificate: Could not load logo", e);
        }
    }

    // -- Content --
    doc.setTextColor(2, 62, 138); // Deep Ocean Blue
    
    // Header - Course Title as Main Heading
    doc.setFontSize(42); // Slightly smaller to fit logo
    // Determine font - use helvetica bold effectively as a display font
    doc.setFont("helvetica", "bold");
    const headerY = logoUrl ? 60 : 50;
    // Handle potentially long titles by splitting text
    const splitTitle = doc.splitTextToSize(safeCourseName, 220);
    doc.text(splitTitle, width / 2, headerY, { align: "center" });

    // Subheader
    let yPos = headerY + (splitTitle.length * 12);
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 119, 182); // Lighter Blue
    doc.text("THIS CERTIFICATE IS PROUDLY PRESENTED TO", width / 2, yPos + 5, { align: "center" });

    // User Name (Larger)
    doc.setTextColor(3, 4, 94); // Dark Navy
    doc.setFontSize(32);
    doc.setFont("times", "italic");
    doc.text(safeUserName, width / 2, yPos + 25, { align: "center" });
    
    // Underline user name
    doc.setDrawColor(0, 150, 199); 
    doc.setLineWidth(0.5);
    doc.line(width / 2 - 80, yPos + 30, width / 2 + 80, yPos + 30); 

    // Achievement Text
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text("For successfully completing this course", width / 2, yPos + 45, { align: "center" });

    yPos = yPos + 45;

    // Date
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(`Completed on ${safeCompletedDate}`, width / 2, yPos + 10, { align: "center" });
    
    // Footer / Issuer
    yPos += 30;
    
    // Signature Line Area (Center aligned for single issuer)
    doc.setDrawColor(0, 119, 182);
    doc.setLineWidth(0.5);
    doc.line(width / 2 - 40, yPos, width / 2 + 40, yPos);
    
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(safeSiteName, width / 2, yPos + 6, { align: "center" });
    doc.setFontSize(10);
    doc.setTextColor(0, 150, 199);
    doc.text("ISSUING ORGANIZATION", width / 2, yPos + 11, { align: "center" });

    // Save
    const safeFilename = safeCourseName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    doc.save(`${safeFilename}_certificate.pdf`);
};
