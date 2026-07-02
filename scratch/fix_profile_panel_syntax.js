import fs from 'fs';

const filePath = 'src/panels/ProfilePanel.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Target 1: Stats block closing tag fix
const target1 = `                  </div>
                )}
              </div>
            )}
            </div>`;

const replacement1 = `                  </div>
                )}
              </div>
            </div>
          )}*`; // Use temporary placeholder * to differentiate the two </div> tags if needed, or just normal replacement

// Let's do it precisely using direct string replacement:
const targetBlock1 = `                  </div>
                )}
              </div>
            )}
            </div>
          </div>
        </div>`;

const replacementBlock1 = `                  </div>
                )}
              </div>
            </div>
          )}
          </div>
        </div>`;


// Target 2: Column wrapper closing tag fix
const targetBlock2 = `          )}
          </>
        )}
    </div>
  </div>`;

const replacementBlock2 = `          )}
        </div>
      </>
    )}
  </div>`;

const cleanContent = content.replace(/\r\n/g, '\n');
const cleanTargetBlock1 = targetBlock1.replace(/\r\n/g, '\n');
const cleanReplacementBlock1 = replacementBlock1.replace(/\r\n/g, '\n');
const cleanTargetBlock2 = targetBlock2.replace(/\r\n/g, '\n');
const cleanReplacementBlock2 = replacementBlock2.replace(/\r\n/g, '\n');

if (cleanContent.includes(cleanTargetBlock1) && cleanContent.includes(cleanTargetBlock2)) {
  const newContent = cleanContent
    .replace(cleanTargetBlock1, cleanReplacementBlock1)
    .replace(cleanTargetBlock2, cleanReplacementBlock2);
  fs.writeFileSync(filePath, newContent.replace(/\n/g, '\r\n'), 'utf8');
  console.log("ProfilePanel syntax error fixed successfully.");
} else {
  console.error("Syntax fix targets not found in ProfilePanel.tsx!");
}
