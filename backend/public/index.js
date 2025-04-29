const dropZone = document.querySelector(".drop-zone");
const fileInput = document.querySelector("#fileInput");
const browseBtn = document.querySelector("#browseBtn");

const bgProgress = document.querySelector(".bg-progress");
const progressPercent = document.querySelector("#progressPercent");
const progressContainer = document.querySelector(".progress-container");
const progressBar = document.querySelector(".progress-bar");
const status = document.querySelector(".status");

const sharingContainer = document.querySelector(".sharing-container");
const copyURLBtn = document.querySelector("#copyURLBtn");
const fileURL = document.querySelector("#fileURL");
const emailForm = document.querySelector("#emailForm");

const toast = document.querySelector(".toast");

const baseURL = window.location.origin; // Dynamic base URL
const uploadURL = `${baseURL}/api/files`;
const emailURL = `${baseURL}/api/files/send`;

const maxAllowedSize = 100 * 1024 * 1024; //100mb

// Check if user is authenticated
const isAuthenticated = document.body.dataset.authenticated === "true";

browseBtn.addEventListener("click", () => {
    fileInput.click();
});

dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length === 1) {
        if (files[0].size < maxAllowedSize) {
            fileInput.files = files;
            uploadFile();
        } else {
            showToast("Max file size is 100MB");
        }
    } else if (files.length > 1) {
        showToast("You can't upload multiple files");
    }
    dropZone.classList.remove("dragged");
});

dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragged");
});

dropZone.addEventListener("dragleave", (e) => {
    dropZone.classList.remove("dragged");
});

// file input change and uploader
fileInput.addEventListener("change", () => {
    if (fileInput.files[0].size > maxAllowedSize) {
        showToast("Max file size is 100MB");
        fileInput.value = ""; // reset the input
        return;
    }
    uploadFile();
});

// sharing container listeners
if (copyURLBtn) {
    copyURLBtn.addEventListener("click", () => {
        fileURL.select();
        document.execCommand("copy");
        showToast("Copied to clipboard");
    });
}

if (fileURL) {
    fileURL.addEventListener("click", () => {
        fileURL.select();
    });
}

// Email form submission
if (emailForm) {
    emailForm.addEventListener("submit", (e) => {
        e.preventDefault(); // stop submission

        // disable the button
        emailForm.querySelector("button").setAttribute("disabled", "true");
        emailForm.querySelector("button").innerText = "Sending";

        const url = fileURL.value;

        const formData = {
            uuid: url.split("/").splice(-1, 1)[0],
            emailTo: emailForm.elements["to-email"].value,
            emailFrom: emailForm.elements["from-email"].value,
        };
        
        fetch(emailURL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(formData),
        })
            .then((res) => res.json())
            .then((data) => {
                if (data.success) {
                    showToast("Email Sent");
                    sharingContainer.style.display = "none"; // hide the box
                } else {
                    showToast(data.error || "Failed to send email");
                    emailForm.querySelector("button").removeAttribute("disabled");
                    emailForm.querySelector("button").innerText = "Send";
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showToast("Failed to send email");
                emailForm.querySelector("button").removeAttribute("disabled");
                emailForm.querySelector("button").innerText = "Send";
            });
    });
}

const uploadFile = () => {
    console.log("file added uploading");

    files = fileInput.files;
    const formData = new FormData();
    formData.append("myfile", files[0]);

    //show the uploader
    progressContainer.style.display = "block";

    // upload file
    const xhr = new XMLHttpRequest();

    // listen for upload progress
    xhr.upload.onprogress = function (event) {
        // find the percentage of uploaded
        let percent = Math.round((100 * event.loaded) / event.total);
        progressPercent.innerText = percent;
        const scaleX = `scaleX(${percent / 100})`;
        bgProgress.style.transform = scaleX;
        progressBar.style.transform = scaleX;
    };

    // handle error
    xhr.upload.onerror = function () {
        showToast(`Error in upload: ${xhr.status}.`);
        fileInput.value = ""; // reset the input
    };

    // listen for response which will give the link
    xhr.onreadystatechange = function () {
        if (xhr.readyState == XMLHttpRequest.DONE) {
            console.log('Response received:', xhr.status, xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    onFileUploadSuccess(xhr.responseText);
                } catch (error) {
                    console.error('Error parsing response:', error);
                    showToast('Error processing server response');
                }
            } else {
                showToast(`Error: ${xhr.status}. ${xhr.responseText || 'Check console for details'}`);
                console.error('Upload failed:', xhr.status, xhr.responseText);
            }
        }
    };

    xhr.open("POST", uploadURL);
    xhr.send(formData);
};

const onFileUploadSuccess = (res) => {
    fileInput.value = ""; // reset the input
    status.innerText = "Uploaded";

    // remove the disabled attribute from form btn & make text send
    if (emailForm) {
        emailForm.querySelector("button").removeAttribute("disabled");
        emailForm.querySelector("button").innerText = "Send";
    }
    
    progressContainer.style.display = "none"; // hide the box

    try {
        const response = JSON.parse(res);
        console.log('Parsed response:', response);
        
        if (response.file) {
            showToast('File uploaded successfully');
            console.log('File URL:', response.file);
            sharingContainer.style.display = "block";
            fileURL.value = response.file;
            
            // Add a "Go to Dashboard" button
            if (!document.querySelector('.dashboard-btn')) {
                const dashboardBtn = document.createElement('div');
                dashboardBtn.className = 'dashboard-btn';
                dashboardBtn.innerHTML = `
                    <p class="text-center mt-4">
                        <a href="/dashboard" class="btn btn-primary">Go to Dashboard</a>
                    </p>
                `;
                sharingContainer.appendChild(dashboardBtn);
            }
        } else if (response.error) {
            showToast(`Error: ${response.error}`);
            console.error('Server returned error:', response.error);
        } else {
            showToast('Unknown response format from server');
            console.error('Unknown response format:', response);
        }
    } catch (err) {
        showToast('Error processing server response');
        console.error('Error parsing JSON:', err, 'Response:', res);
    }
};

let toastTimer;
// the toast function
const showToast = (msg) => {
    clearTimeout(toastTimer);
    toast.innerText = msg;
    toast.classList.add("show");
    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2000);
};