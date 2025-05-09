import { serverURL } from "./config.js";

// Global variables
let editingPostId = null; // Tracks edit mode; null means we're creating a new post.
let currentBlogImages = []; // Stores the blog images of the post being edited

// --- AUTO-FILL TODAY'S DATE & PREVENT PAST AND FUTURE SELECTION ---
$(document).ready(function () {
  const $dateInput = $("#date");
  if ($dateInput) {
    const today = new Date().toISOString().split("T")[0];
    $dateInput.val(today);
    $dateInput.attr("min", today); //Prevent past dates
    $dateInput.attr("max", today); //Prevent future dates
  }
});

// --- FETCH & RENDER POSTS ---
async function fetchPosts() {
  try {
    const response = await fetch(serverURL);
    const posts = await response.json();
    renderPosts(posts);
  } catch (error) {
    console.error("Erro fetching posts: ", error);
  }
}

function renderPosts(posts) {
  const $blogPostsContainer = $("#blog-posts");
  $blogPostsContainer.html(""); //Clear previous content

  if (posts.length === 0) {
    $blogPostsContainer.html(`<p class="text-center">No posts found</p>`);
    return;
  }

  posts.forEach((post) => {
    const imagesArray = Array.isArray(post.blogImages) ? post.blogImages : [];

    const profilePicHTML = post.profilePicture?.trim()
      ? `<img src="${post.profilePicture}" alt="${post.name}'s profile picture" class="profile-pic" />`
      : `<img src="./assets/default-profile.jpg" alt="Default profile picture" class="profile-pic" />`;

    const blogImagesHTML = imagesArray
      .map(
        (image) =>
          `<img src="${image}" alt="Blog image for ${post.title}" class="blog-image">`
      )
      .join("");

    // Format date as DD/MM/YYYY and make it bold
    let formattedDate = "<strong>Unknown Date</strong>";
    if (post.date) {
      const [year, month, day] = post.date.split("-");
      formattedDate = `<i>${day}/${month}/${year}</i>`;
    }

    $blogPostsContainer.prepend(`
        <div class="blog-post">
          <div class="post-header d-flex align-items-center">
            ${profilePicHTML}
            <div>
              <h3>${post.title}</h3>
              <span class="post-author">By ${post.name}</span>
              <h6 class="post-date text-black mt-1">${formattedDate}</h6>
            </div>
            <button class="toggle-content btn btn-sm ms-auto" data-state="closed">+</button>
          </div>
          <p class="blog-content" style="display: none;">${post.content}</p>
          <div class="blog-images blog-content" style="display: none;">
            ${blogImagesHTML}
          </div>
          <div class="mt-2">
            <button class="btn btn-warning btn-sm me-2 edit-btn blog-content" style="display: none;" data-id="${post.id}">Edit</button>
            <button class="btn btn-danger btn-sm delete-btn blog-content" style="display: none;" data-id="${post.id}">Delete</button>
          </div>
        </div>
        `);
  });

  // Toggle blog content
  $(document).off("click", ".toggle-content").on("click", ".toggle-content", function () {
    let $toggleButton = $(this);
    let $blogContent = $toggleButton.closest(".blog-post").find(".blog-content");

    if ($blogContent.is(":visible")) {
        $blogContent.slideUp();
        $toggleButton.text("+").attr("data-state", "closed");
    } else {
        $blogContent.slideDown();
        $toggleButton.text("−").attr("data-state", "open");
    }
  });

  // Attach event listeners for Edit and Delete buttons
  $(document).off("click", ".edit-btn").on("click", ".edit-btn", function () {
    const postId = $(this).data("id");
    editPost(postId);
  });

  $(document).off("click", ".delete-btn").on("click", ".delete-btn", function () {
    const postId = $(this).data("id");
    deletePost(postId);
  });
}

// --- FORM HANDLING ---
$("#blog-form").on("submit", async function (event) {
  event.preventDefault();

  // Validate mandatory fields.
  const title = $("#title").val().trim();
  const name = $("#name").val().trim();
  const content = $("#content").val().trim();
  if (!title || !name || !content) {
    alert("Title, Author Name, and Content are required.");
    return;
  }

  // Process profile picture by storing its file path.
  const profilePicInput = $("#profile-pic")[0];
  let profilePicturePath = "";
  if (profilePicInput.files && profilePicInput.files.length > 0) {
    profilePicturePath = "assets/" + profilePicInput.files[0].name;
  }

  // Build the post object.
  let postData = {
    title,
    name,
    content,
    profilePicture: profilePicturePath,
  };

  if (editingPostId !== null) {
    // In edit mode, retain existing blog images.
    postData.blogImages = currentBlogImages;
  } else {
    // New Post - Generate Sequential ID.
    let newId = "1";
    try {
      const responsePosts = await fetch(serverURL);
      const posts = await responsePosts.json();
      if (posts.length > 0) {
        newId = Math.max(...posts.map((post) => Number(post.id))) + 1;
      }
    } catch (error) {
      console.error("Error fetching posts for ID generation:", error);
    }
    // Force new post ID to a string.
    postData.id = String(newId);

    // Process blog images by storing file paths.
    const imagesInput = $("#images")[0];
    let blogImagesPaths = [];
    if (imagesInput.files && imagesInput.files.length > 0) {
      blogImagesPaths = Array.from(imagesInput.files).map(
        (file) => "assets/" + file.name
      );
    }
    postData.blogImages = blogImagesPaths;
  }

  // DATE FUNCTIONALITY:
  // Force the date to be today's date.
  const today = new Date().toISOString().split("T")[0];
  $("#date").val(today);
  postData.date = today;

  try {
    if (editingPostId !== null) {
      const response = await fetch(`${serverURL}/${editingPostId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postData),
      });
      if (!response.ok) throw new Error("Failed to update post");

      editingPostId = null;
      $("#blog-form button[type='submit']").text("Create Blog");
      $("#images-container").show();
      $("#form-heading").text("Create Blog");
    } else {
      // Missing POST request for new blog post creation
      const response = await fetch(serverURL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postData),
      });
      if (!response.ok) throw new Error("Failed to create post");
    }

    $("#blog-form")[0].reset();
    fetchPosts();

    if ($(window).width() < 992) {
      $("html, body").animate({ scrollTop: 0 }, "smooth");
    } else {
      $("#blog-posts")[0].scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  } catch (error) {
    console.error("Error submitting the form:", error);
  }

  updateFormButtons();
});

// --- DELETE FUNCTION ---
async function deletePost(postId) {
  try {
    const response = await fetch(`${serverURL}/${postId}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete post");
    fetchPosts();
  } catch (error) {
    console.error(`Error deleting post ${postId}:`, error);
  }
}     

// --- EDIT FUNCTION ---
async function editPost(postId) {
  try {
    const response = await fetch(`${serverURL}/${postId}`);
    if (!response.ok) throw new Error("Failed to fetch post for editing");

    const post = await response.json();

    // Populate form fields with existing post data
    $("#title").val(post.title);
    $("#name").val(post.name);
    $("#content").val(post.content);
    
    // Always update the date to today's date in edit mode.
    const today = new Date().toISOString().split("T")[0];
    $("#date").val(today);
    post.date = today;

    editingPostId = postId;
    $("#blog-form button[type='submit']").text("Update Blog");
    $("#form-heading").text("Edit Blog");

    // Retain existing blog images during edit, but hide the option to upload new images.
    currentBlogImages = post.blogImages || [];
    $("#images-container").hide();

    // For small screens: 
    // - Show the Create Blog section (so the form is visible)
    // - Set the mobile toggle's text to "×" to indicate editing (or cancellation) mode.
    const $createBlogSection = $("#create-blog");
    $createBlogSection.show();
    if ($(window).width() < 992) {
      $("#toggle-create-blog").text("×");
    }
    
    // Scroll the form into view.
    $createBlogSection.get(0).scrollIntoView({ behavior: "smooth", block: "start" });

  } catch (error) {
    console.error("Error fetching post for editing:", error);
  }

  updateFormButtons();
}

// --- CANCEL EDIT FUNCTION ---
function cancelEdit() {
  $("#blog-form")[0].reset();
  editingPostId = null;
  $("#blog-form button[type='submit']").text("Create Blog");
  $("#images-container").show();
  $("#form-heading").text("Create Blog");

  // Hide Cancel Edit button.
  $("#cancel-edit").hide();

  // On small screens, hide the Create Blog section.
  if ($(window).width() < 992) {
    $("#create-blog").hide();
    $("#toggle-create-blog").text("+");
  }

  $("html, body").animate({ scrollTop: 0 }, "smooth");

  // Update form buttons.
  updateFormButtons();
}

// --- CLEAR BLOG FUNCTION ---
function clearBlogForm() {
  $("#blog-form")[0].reset();
  editingPostId = null;
  $("#blog-form button[type='submit']").text("Create Blog");
  $("#images-container").show();
  $("#form-heading").text("Create Blog");
  
  // Update form buttons.
  updateFormButtons();
}

// Attach Clear Blog button event listener.
const $clearBlogButton = $("#clear-blog");
if ($clearBlogButton.length) {
  $clearBlogButton.on("click", clearBlogForm);
}

// --- UPDATE FORM BUTTONS FUNCTION ---
function updateFormButtons() {
  const $clearBlogButton = $("#clear-blog");
  const $cancelEditButton = $("#cancel-edit");

  if ($(window).width() >= 992) {
    if (editingPostId !== null) {  // Update mode.
      $cancelEditButton.show();
      $clearBlogButton.hide();
    } else {  // Create mode.
      $cancelEditButton.hide();
      $clearBlogButton.show();
    }
  } else {
    // On small screens, hide both.
    $cancelEditButton.hide();
    $clearBlogButton.hide();
  }
}

// Listen for Cancel Edit button click.
const $cancelEditButton = $("#cancel-edit");
if ($cancelEditButton.length) {
  $cancelEditButton.on("click", cancelEdit);
}

// --- DYNAMIC SEARCH ---
$("#search-bar").on("input", async function () {
  const query = $(this).val().toLowerCase();
  try {
    const response = await fetch(serverURL);
    const posts = await response.json();
    const filteredPosts = posts.filter(
      (post) =>
        post.title.toLowerCase().includes(query) ||
        post.name.toLowerCase().includes(query) ||
        post.content.toLowerCase().includes(query)
    );
    renderPosts(filteredPosts);
  } catch (error) {
    console.error("Error filtering posts:", error);
  }
});

// --- INITIAL FETCH & MOBILE TOGGLE ---
fetchPosts();

$("#toggle-create-blog").on("click", function () {
  const $createBlogSection = $("#create-blog");

  if (!$createBlogSection.is(":visible")) {
    $createBlogSection.show();
    $(this).text("×");
    $createBlogSection.get(0).scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    $createBlogSection.hide();
    $(this).text("+");
    $("#blog-form")[0].reset();
    editingPostId = null;
    $("#form-heading").text("Create Blog");
    $("#images-container").show();
  }
  
  // Always update form buttons after toggling.
  updateFormButtons();
});

// Expose edit, delete, and cancel functions globally.
window.editPost = editPost;
window.deletePost = deletePost;
window.cancelEdit = cancelEdit;

// --- WINDOW RESIZE LISTENER FOR RESPONSIVENESS ---
function updateUIForScreenSize() {
  if ($(window).width() >= 992) {
    // For larger screens, ensure the Create Blog section is visible and clear the mobile toggle.
    $("#create-blog").show();
    $("#toggle-create-blog").text("");
  } else {
    // For smaller screens, hide the Create Blog section.
    $("#create-blog").hide();
    $("#toggle-create-blog").text("+");
  }
  // Update the buttons accordingly.
  updateFormButtons();
}

$(window).on("resize", updateUIForScreenSize);
// Initial call on load.
updateUIForScreenSize();
