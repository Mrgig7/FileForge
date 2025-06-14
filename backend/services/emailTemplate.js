module.exports = ({ emailFrom, downloadLink, size, expires }) => {
    return `
        <!doctype html>
            <html>
            <head>
                <meta name="viewport" content="width=device-width">
                <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
                <title>FileForge File Sharing</title>
                <style>
                /* -------------------------------------
                    RESPONSIVE AND MOBILE FRIENDLY STYLES
                ------------------------------------- */
                @media only screen and (max-width: 620px) {
                  table[class=body] h1 {
                    font-size: 28px !important;
                    margin-bottom: 10px !important;
                  }
                  table[class=body] p,
                        table[class=body] ul,
                        table[class=body] ol,
                        table[class=body] td,
                        table[class=body] span,
                        table[class=body] a {
                    font-size: 16px !important;
                  }
                  table[class=body] .wrapper,
                        table[class=body] .article {
                    padding: 10px !important;
                  }
                  table[class=body] .content {
                    padding: 0 !important;
                  }
                  table[class=body] .container {
                    padding: 0 !important;
                    width: 100% !important;
                  }
                  table[class=body] .main {
                    border-left-width: 0 !important;
                    border-radius: 0 !important;
                    border-right-width: 0 !important;
                  }
                  table[class=body] .btn table {
                    width: 100% !important;
                  }
                  table[class=body] .btn a {
                    width: 100% !important;
                  }
                  table[class=body] .img-responsive {
                    height: auto !important;
                    max-width: 100% !important;
                    width: auto !important;
                  }
                }
            
                /* -------------------------------------
                    PRESERVE THESE STYLES IN THE HEAD
                ------------------------------------- */
                @media all {
                  .ExternalClass {
                    width: 100%;
                  }
                  .ExternalClass,
                        .ExternalClass p,
                        .ExternalClass span,
                        .ExternalClass font,
                        .ExternalClass td,
                        .ExternalClass div {
                    line-height: 100%;
                  }
                  .apple-link a {
                    color: inherit !important;
                    font-family: inherit !important;
                    font-size: inherit !important;
                    font-weight: inherit !important;
                    line-height: inherit !important;
                    text-decoration: none !important;
                  }
                  #MessageViewBody a {
                    color: inherit;
                    text-decoration: none;
                    font-size: inherit;
                    font-family: inherit;
                    font-weight: inherit;
                    line-height: inherit;
                  }
                  .btn-primary table td:hover {
                    background-color: #4361ee !important;
                  }
                  .btn-primary a:hover {
                    background-color: #4361ee !important;
                    border-color: #4361ee !important;
                  }
                }
                </style>
            </head>
            <body class="" style="background-color: #1a1c23; font-family: sans-serif; -webkit-font-smoothing: antialiased; font-size: 14px; line-height: 1.4; margin: 0; padding: 0; -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%;">
                <table border="0" cellpadding="0" cellspacing="0" class="body" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%; background-color: #1a1c23;">
                <tr>
                    <td style="font-family: sans-serif; font-size: 14px; vertical-align: top;">&nbsp;</td>
                    <td class="container" style="font-family: sans-serif; font-size: 14px; vertical-align: top; display: block; Margin: 0 auto; max-width: 580px; padding: 10px; width: 580px;">
                    <div class="content" style="box-sizing: border-box; display: block; Margin: 0 auto; max-width: 580px; padding: 10px;">
            
                        <!-- START CENTERED CONTAINER -->
                        <span class="preheader" style="color: transparent; display: none; height: 0; max-height: 0; max-width: 0; opacity: 0; overflow: hidden; mso-hide: all; visibility: hidden; width: 0;">A file has been shared with you via FileForge</span>
                        <table class="main" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%; background: #252836; border-radius: 8px; border: 1px solid #36384a;">
            
                        <!-- START MAIN CONTENT AREA -->
                        <tr>
                            <td class="wrapper" style="font-family: sans-serif; font-size: 14px; vertical-align: top; box-sizing: border-box; padding: 20px;">
                            <table border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;">
                                <tr>
                                <td style="font-family: sans-serif; font-size: 14px; vertical-align: top;">
                                    <div style="text-align: center; margin-bottom: 20px;">
                                        <h1 style="color: #4361ee; font-size: 24px; margin: 0; margin-bottom: 5px;">
                                            File<span style="color: #f3f4f7;">Forge</span>
                                        </h1>
                                        <p style="color: #b1b5c3; font-size: 12px; margin: 0;">Secure File Sharing</p>
                                    </div>
                                    
                                    <div style="background-color: rgba(255, 255, 255, 0.05); border-radius: 6px; padding: 15px; margin-bottom: 20px; border: 1px solid rgba(255, 255, 255, 0.1);">
                                        <p style="font-family: sans-serif; font-size: 16px; font-weight: 600; margin: 0; margin-bottom: 15px; color: #f3f4f7;">
                                            A file has been shared with you
                                        </p>
                                        <p style="font-family: sans-serif; font-size: 14px; font-weight: normal; margin: 0; margin-bottom: 15px; color: #b1b5c3;">
                                            <strong style="color: #f3f4f7;">${emailFrom}</strong> has shared a file with you via FileForge.
                                        </p>
                                        <p style="font-family: sans-serif; font-size: 13px; font-weight: normal; margin: 0; margin-bottom: 15px; color: #b1b5c3;">
                                            File size: <strong style="color: #f3f4f7;">${size}</strong> • Available for <strong style="color: #f3f4f7;">${expires}</strong>
                                        </p>
                                    </div>
                                    
                                    <table border="0" cellpadding="0" cellspacing="0" class="btn btn-primary" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%; box-sizing: border-box;">
                                    <tbody>
                                        <tr>
                                        <td align="center" style="font-family: sans-serif; font-size: 14px; vertical-align: top; padding-bottom: 15px;">
                                            <table border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: auto;">
                                            <tbody>
                                                <tr>
                                                <td style="font-family: sans-serif; font-size: 14px; vertical-align: top; background-color: #4361ee; border-radius: 5px; text-align: center;"> 
                                                    <a href="${downloadLink}" target="_blank" style="display: inline-block; color: #ffffff; background-color: #4361ee; border: solid 1px #4361ee; border-radius: 5px; box-sizing: border-box; cursor: pointer; text-decoration: none; font-size: 14px; font-weight: bold; margin: 0; padding: 12px 25px; text-transform: capitalize; border-color: #4361ee;">
                                                        View and Download File
                                                    </a> 
                                                </td>
                                                </tr>
                                            </tbody>
                                            </table>
                                        </td>
                                        </tr>
                                    </tbody>
                                    </table>
                                    
                                    <p style="font-family: sans-serif; font-size: 14px; font-weight: normal; margin: 0; margin-bottom: 15px; color: #b1b5c3;">
                                        If the button doesn't work, copy and paste this link into your browser:
                                    </p>
                                    <p style="font-family: sans-serif; font-size: 12px; font-weight: normal; margin: 0; margin-bottom: 15px; padding: 10px; background-color: rgba(0, 0, 0, 0.2); border-radius: 5px; word-break: break-all; color: #f3f4f7;">
                                        ${downloadLink}
                                    </p>
                                    
                                    <p style="font-family: sans-serif; font-size: 14px; font-weight: normal; margin: 0; margin-top: 30px; color: #b1b5c3;">
                                        Thank you for using FileForge!
                                    </p>
                                </td>
                                </tr>
                            </table>
                            </td>
                        </tr>
            
                        <!-- END MAIN CONTENT AREA -->
                        </table>
            
                        <!-- START FOOTER -->
                        <div class="footer" style="clear: both; Margin-top: 10px; text-align: center; width: 100%;">
                        <table border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;">
                            <tr>
                            <td class="content-block" style="font-family: sans-serif; vertical-align: top; padding-bottom: 10px; padding-top: 10px; font-size: 12px; color: #b1b5c3; text-align: center;">
                                <span class="apple-link" style="color: #b1b5c3; font-size: 12px; text-align: center;">FileForge ©️ 2024</span>
                                <br> Want to share a file? <a href="${process.env.APP_BASE_URL}" style="text-decoration: underline; color: #4361ee; font-size: 12px; text-align: center;">Try FileForge</a>
                            </td>
                            </tr>
                        </table>
                        </div>
                        <!-- END FOOTER -->
            
                    <!-- END CENTERED CONTAINER -->
                    </div>
                    </td>
                    <td style="font-family: sans-serif; font-size: 14px; vertical-align: top;">&nbsp;</td>
                </tr>
                </table>
            </body>
        </html>
    `;
};